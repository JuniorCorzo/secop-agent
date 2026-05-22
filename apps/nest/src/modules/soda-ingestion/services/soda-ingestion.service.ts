import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Cron } from "@nestjs/schedule";
import type { Repository } from "typeorm";
import { sodaConfig } from "../../../config/soda.config";
import { SodaStreamerService } from "./soda-streamer.service";
import { IngestionState } from "../entities/ingestion-state.entity";
import { ProcurementNotice } from "../../procurement-notices/entities/procurement-notice.entity";

type DatasetSource = "SECOP_I" | "SECOP_II";

/**
 * Orchestrates SODA ingestion cycles (bootstrap + cron) with persistent
 * cursor state in the `ingestion_state` table.
 *
 * Replaces the old in-memory `Map` — survives process restarts.
 *
 * On first run (no row in `ingestion_state`), seeds the cursor from
 * `SELECT MAX(source_last_updated_at)` of existing `ProcurementNotice` rows.
 *
 * Delegates fetching, mapping, filtering, and enqueuing to
 * {@link SodaStreamerService}, which uses cursor-based pagination
 * and micro-batch enqueuing to BullMQ.
 */
@Injectable()
export class SodaIngestionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SodaIngestionService.name);
  private readonly config;
  private isRunning = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly sodaStreamer: SodaStreamerService,
    @InjectRepository(IngestionState)
    private readonly ingestionStateRepo: Repository<IngestionState>,
    @InjectRepository(ProcurementNotice)
    private readonly noticeRepo: Repository<ProcurementNotice>,
  ) {
    this.config = sodaConfig({
      SODA_API_URL: this.configService.get("SODA_API_URL"),
      SODA_APP_TOKEN: this.configService.get("SODA_APP_TOKEN"),
      SODA_DATASET_SECOP1: this.configService.get("SODA_DATASET_SECOP1"),
      SODA_DATASET_SECOP2: this.configService.get("SODA_DATASET_SECOP2"),
      SODA_PAGE_SIZE: this.configService.get("SODA_PAGE_SIZE"),
      SODA_MAX_PAGES: this.configService.get("SODA_MAX_PAGES"),
      SODA_CRON: this.configService.get("SODA_CRON"),
      SODA_SINCE: this.configService.get("SODA_SINCE"),
    });
  }

  /**
   * Fires a background ingestion cycle immediately after the app finishes
   * bootstrapping. Ensures the DB is populated on first start without
   * waiting up to 6h for the first cron tick.
   *
   * Runs in the background — bootstrap is not blocked.
   * Errors are caught and logged so they never crash the process.
   */
  onApplicationBootstrap(): void {
    this.logger.log("Bootstrap trigger: starting initial SODA ingestion cycle");
    this.runIngestionCycle("bootstrap").catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Bootstrap ingestion cycle failed: ${message}`);
    });
  }

  @Cron(process.env.SODA_CRON ?? "0 */6 * * *")
  async handleCron(): Promise<void> {
    this.logger.log(
      `Cron trigger: starting scheduled SODA ingestion cycle [expr=${process.env.SODA_CRON ?? "0 */6 * * *"}]`,
    );
    await this.runIngestionCycle("cron");
  }

  async runIngestionCycle(
    trigger: "bootstrap" | "cron" = "cron",
  ): Promise<void> {
    if (this.isRunning) {
      this.logger.warn(
        `[${trigger}] Skipping SODA ingestion cycle because previous cycle is still running`,
      );
      return;
    }

    this.isRunning = true;
    const cycleStart = Date.now();
    this.logger.log(`[${trigger}] SODA ingestion cycle started`);

    try {
      await Promise.allSettled([
        this.fetchAndIngest(this.config.datasetSecop1, "SECOP_I", trigger),
        this.fetchAndIngest(this.config.datasetSecop2, "SECOP_II", trigger),
      ]);
    } finally {
      this.isRunning = false;
      const elapsed = ((Date.now() - cycleStart) / 1000).toFixed(1);
      this.logger.log(
        `[${trigger}] SODA ingestion cycle finished in ${elapsed}s`,
      );
    }
  }

  // ── Per-dataset ingestion ──────────────────────────────────

  private async fetchAndIngest(
    datasetId: string,
    source: DatasetSource,
    trigger: "bootstrap" | "cron",
  ): Promise<void> {
    const state = await this.ensureIngestionState(source);
    const isIncremental = !!state.lastCursorValue;

    this.logger.log(
      `[${trigger}][${source}] Streaming dataset=${datasetId} mode=${isIncremental ? "incremental" : "full"} since=${state.lastCursorValue}}`,
    );

    try {
      const whereClause = this.buildWhereClause(source, state.lastCursorValue);
      this.logger.log(`WHERE clause: ${whereClause}`);
      const result = await this.sodaStreamer.streamToQueue(
        datasetId,
        source,
        whereClause,
      );

      // Persist the cursor from the last ingested record
      await this.ingestionStateRepo.update(
        { source },
        {
          lastCursorValue: result.lastCursorValue ?? state.lastCursorValue,
          consecutiveFailures: 0,
        },
      );

      this.logger.log(
        `[${trigger}][${source}] Stream complete: ${result.total} fetched, ${result.enqueued} enqueued, ${result.filtered} cancelled/rejected filtered. Cursor: ${result.lastCursorValue ?? "unchanged"}`,
      );
    } catch (error) {
      const nextFailures = state.consecutiveFailures + 1;
      const message = error instanceof Error ? error.message : String(error);

      await this.ingestionStateRepo.update(
        { source },
        { consecutiveFailures: nextFailures },
      );

      if (nextFailures >= 3) {
        this.logger.error(
          `[${trigger}][${source}] Dataset accumulated ${nextFailures} consecutive failures: ${message}`,
        );
      } else {
        this.logger.warn(
          `[${trigger}][${source}] Dataset failed (attempt ${nextFailures}): ${message}`,
        );
      }
    }
  }

  // ── State helpers ───────────────────────────────────────────

  /**
   * Ensures an `ingestion_state` row exists for the dataset.
   *
   * If no row exists (first run ever, or DB reset):
   *  1. Uses `SODA_SINCE` from config if set (the sampling cutoff).
   *  2. Falls back to `MAX(source_last_updated_at)` of existing
   *     `ProcurementNotice` rows for this source.
   *  3. Falls back to `null` (full scan from the beginning) if the table is empty.
   */
  private async ensureIngestionState(
    source: DatasetSource,
  ): Promise<IngestionState> {
    const existing = await this.ingestionStateRepo.findOne({
      where: { source },
    });
    if (existing) {
      if (!existing.lastCursorValue && this.config.since) {
        this.logger.log(
          `[${source}] Persisting SODA_SINCE fallback cursor: ${this.config.since}`,
        );
        await this.ingestionStateRepo.update(
          { source },
          { lastCursorValue: this.config.since },
        );
        existing.lastCursorValue = this.config.since;
      }

      return {
        ...existing,
        lastCursorValue: existing.lastCursorValue ?? this.config.since,
      };
    }

    // Priority: SODA_SINCE env var > MAX(existing data) > null (full scan)
    const maxTimestamp =
      this.config.since ?? (await this.getMaxExistingTimestamp(source));

    this.logger.log(
      `[${source}] First run detected — seeding cursor: ${maxTimestamp ?? "null (full scan)"}${this.config.since ? ` [SODA_SINCE=${this.config.since}]` : ""}`,
    );

    const row = this.ingestionStateRepo.create({
      source,
      lastCursorValue: maxTimestamp,
      consecutiveFailures: 0,
    });
    return this.ingestionStateRepo.save(row);
  }

  /**
   * Queries the maximum `source_last_updated_at` from existing notices.
   *
   * Returns an ISO 8601 string (SoQL-compatible) or `null` if the table
   * is empty for this source.
   */
  private async getMaxExistingTimestamp(
    source: DatasetSource,
  ): Promise<string | null> {
    const result = await this.noticeRepo
      .createQueryBuilder("n")
      .select("MAX(n.sourceLastUpdatedAt)", "max_ts")
      .where("n.source = :source", { source })
      .getRawOne<{ max_ts: Date | null }>();

    if (!result?.max_ts) return null;

    // TypeORM returns timestamptz as a Date object; convert to ISO
    return result.max_ts instanceof Date
      ? result.max_ts.toISOString()
      : String(result.max_ts);
  }

  /**
   * Builds the incremental WHERE clause for the SoQL query.
   *
   * When `cursorValue` is `null`, returns `undefined` (full scan).
   *
   * SECOP_I uses `ultima_actualizacion`; SECOP_II uses `fecha_de_ultima_publicaci`.
   */
  private buildWhereClause(
    source: DatasetSource,
    cursorValue: string | null,
  ): string | undefined {
    if (!cursorValue) return undefined;

    const fieldName =
      source === "SECOP_I"
        ? "ultima_actualizacion"
        : "fecha_de_ultima_publicaci";

    return `${fieldName} > '${cursorValue}'`;
  }
}
