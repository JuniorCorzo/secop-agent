import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { sodaConfig } from "../../../config/soda.config";
import { ProcurementIngestionProducer } from "../../queues/producers/procurement-ingestion.producer";
import {
  IngestionJob,
  IngestionJobStatus,
} from "../../procurement-notices/entities/ingestion-job.entity";
import type { CreateProcurementNoticeDto } from "../../procurement-notices/dto/create-procurement-notice.dto";
import type { SecopIRecord, SecopIIRecord } from "../soda-ingestion.types";
import {
  SECOP_I_SELECT_COLUMNS,
  SECOP_II_SELECT_COLUMNS,
} from "../soda-ingestion.types";
import { mapSecopI } from "../mappers/secop-i.mapper";
import { mapSecopII } from "../mappers/secop-ii.mapper";
import { SodaClientService } from "./soda-client.service";

type DatasetSource = "SECOP_I" | "SECOP_II";

export interface StreamResult {
	total: number;
	enqueued: number;
	filtered: number;
	/** Cursor value from the last processed record (null if no records ingested) */
	lastCursorValue: string | null;
}

/**
 * Status values that represent dead/irrelevant procurement processes.
 * These are filtered out before enqueuing — no value in analyzing cancelled offers.
 */
const SKIPPABLE_STATUSES = new Set(["CANCELLED", "REJECTED"]);

/**
 * Streams SODA API responses through cursor-based pagination into BullMQ in micro-batches.
 *
 * Design decisions (KISS + YAGNI aligned):
 * - Cursor pagination (not offset) → O(1) per page at any depth, no O(n²) scanning.
 * - Micro-batch enqueuing (1000 records/job) → avoids 15M individual jobs in Redis.
 * - Process-each-page-immediately → constant memory regardless of dataset size.
 * - Cancel/Reject filter in-stream → dead processes never hit the queue or DB.
 *
 * Does NOT use Web Streams line-by-line parsing because SODA API returns JSON arrays,
 * not NDJSON. True chunked streaming would require a streaming JSON parser.
 * The cursor-based approach achieves the same memory safety without that complexity.
 */
@Injectable()
export class SodaStreamerService {
  private readonly logger = new Logger(SodaStreamerService.name);
  private readonly config;

  /** Records accumulated before enqueuing a single BullMQ job. */
  private readonly MICRO_BATCH_SIZE = 1000;

  constructor(
    private readonly sodaClientService: SodaClientService,
    private readonly procurementIngestionProducer: ProcurementIngestionProducer,
    @InjectRepository(IngestionJob)
    private readonly ingestionJobRepository: Repository<IngestionJob>,
    private readonly configService: ConfigService,
  ) {
    this.config = sodaConfig({
      SODA_API_URL: this.configService.get("SODA_API_URL"),
      SODA_APP_TOKEN: this.configService.get("SODA_APP_TOKEN"),
      SODA_DATASET_SECOP1: this.configService.get("SODA_DATASET_SECOP1"),
      SODA_DATASET_SECOP2: this.configService.get("SODA_DATASET_SECOP2"),
      SODA_PAGE_SIZE: this.configService.get("SODA_PAGE_SIZE"),
      SODA_MAX_PAGES: this.configService.get("SODA_MAX_PAGES"),
      SODA_CRON: this.configService.get("SODA_CRON"),
    });
  }

  /**
   * Streams an entire SODA dataset into BullMQ using cursor-based pagination.
   *
   * Flow:
   * 1. Create an IngestionJob for audit tracking.
   * 2. Fetch pages via cursor (`field > lastValue`, ASC order).
   * 3. Map each record to DTO, filter cancelled/rejected, accumulate micro-batch.
   * 4. Enqueue micro-batch (1000 records) to BullMQ.
   * 5. Worker persists via upsert (already implemented).
   *
   * Memory: at most MICRO_BATCH_SIZE + pageSize DTOs in memory at any time.
   *
   * @param datasetId  SODA dataset ID (e.g., "p6dx-8zbt")
   * @param source     SECOP_I or SECOP_II (determines mapper + cursor field)
   * @param whereClause Optional pre-filter (e.g., incremental timestamp)
   * @returns Summary counts
   */
  async streamToQueue(
    datasetId: string,
    source: DatasetSource,
    whereClause?: string,
  ): Promise<StreamResult> {
    const orderByField =
      source === "SECOP_I"
        ? "ultima_actualizacion"
        : "fecha_de_ultima_publicaci";

    const selectColumns =
      source === "SECOP_I" ? SECOP_I_SELECT_COLUMNS : SECOP_II_SELECT_COLUMNS;

    // Create tracking job
    const ingestionJob = this.ingestionJobRepository.create({
      status: IngestionJobStatus.ACCEPTED,
      secopId: null,
      createdCount: 0,
      updatedCount: 0,
      failedCount: 0,
      errors: [],
    });
    const savedJob = await this.ingestionJobRepository.save(ingestionJob);

    let cursorValue: string | null = null;
    let totalFetched = 0;
    let totalEnqueued = 0;
    let totalFiltered = 0;
    let microBatch: CreateProcurementNoticeDto[] = [];
    let page = 1;
    const pageSize = this.config.pageSize;
    const startTime = Date.now();

    this.logger.log(
      `[${source}] Starting cursor stream dataset=${datasetId} pageSize=${pageSize}${whereClause ? ` where="${whereClause}"` : ""} jobId=${savedJob.id}`,
    );

    try {
      await this.ingestionJobRepository.update(savedJob.id, {
        status: IngestionJobStatus.PROCESSING,
      });

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const query = this.buildCursorQuery(
          selectColumns,
          orderByField,
          cursorValue,
          whereClause,
        );

        const records = await this.sodaClientService.queryDataset<any>(
          datasetId,
          { query, pageNumber: 1, pageSize },
        );

        if (records.length === 0) break;
        totalFetched += records.length;

        // Map + filter inline — never accumulates more than pageSize in memory
        for (const record of records) {
          const dto = this.mapRecord(record, source);

          // Skip dead processes
          if (dto.status && SKIPPABLE_STATUSES.has(dto.status)) {
            totalFiltered++;
            continue;
          }

          microBatch.push(dto);

          if (microBatch.length >= this.MICRO_BATCH_SIZE) {
            await this.procurementIngestionProducer.add({
              ingestionJobId: savedJob.id,
              records: microBatch,
            });
            totalEnqueued += microBatch.length;
            microBatch = [];
          }
        }

        this.logger.debug(
          `[${source}] Page ${page}: ${records.length} records → total=${totalFetched} enqueued=${totalEnqueued} filtered=${totalFiltered}`,
        );

        if (records.length < pageSize) break;

        cursorValue = records[records.length - 1][orderByField] as string;
        page++;
      }

      // Enqueue final partial batch
      if (microBatch.length > 0) {
        await this.procurementIngestionProducer.add({
          ingestionJobId: savedJob.id,
          records: microBatch,
        });
        totalEnqueued += microBatch.length;
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(
        `[${source}] Stream complete: ${totalFetched} fetched, ${totalEnqueued} enqueued, ${totalFiltered} filtered in ${elapsed}s`,
      );

      await this.ingestionJobRepository.update(savedJob.id, {
        status: IngestionJobStatus.COMPLETED,
        createdCount: totalEnqueued,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[${source}] Stream failed: ${message}`);
      await this.ingestionJobRepository.update(savedJob.id, {
        status: IngestionJobStatus.FAILED,
        errors: [{ secopId: "STREAM", reason: message }],
      });
      throw error;
    }

    return {
      total: totalFetched,
      enqueued: totalEnqueued,
      filtered: totalFiltered,
      lastCursorValue: cursorValue,
    };
  }

  /**
   * Builds a SoQL query string for cursor-based pagination.
   *
   * Format:
   *   `SELECT cols WHERE (base) AND field > 'cursor' ORDER BY field ASC`
   *
   * - First page (cursorValue = null): omits the cursor WHERE clause
   * - No base filter (whereClause = undefined): omits the base WHERE clause
   * - No cursor OR base filter: `SELECT cols ORDER BY field ASC`
   */
  private buildCursorQuery(
    selectColumns: string[],
    orderByField: string,
    cursorValue: string | null,
    whereClause?: string,
  ): string {
    const selectPart = `SELECT ${selectColumns.join(", ")}`;
    const orderPart = `ORDER BY ${orderByField} ASC`;

    const conditions: string[] = [];
    if (whereClause) {
      conditions.push(`(${whereClause})`);
    }
    if (cursorValue) {
      conditions.push(`${orderByField} > '${cursorValue}'`);
    }

    const wherePart =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    return [selectPart, wherePart, orderPart].filter((s) => s).join(" ");
  }

  private mapRecord(
    record: unknown,
    source: DatasetSource,
  ): CreateProcurementNoticeDto {
    return source === "SECOP_I"
      ? mapSecopI(record as SecopIRecord)
      : mapSecopII(record as SecopIIRecord);
  }
}
