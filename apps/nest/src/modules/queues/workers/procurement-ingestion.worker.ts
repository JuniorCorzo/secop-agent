import { Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NewProcurementNoticeEvent } from "../../procurement-notices/events/new-procurement-notice.event";
import { ProcurementNotice } from "../../procurement-notices/entities/procurement-notice.entity";
import {
  IngestionJob,
  IngestionJobStatus,
} from "../../procurement-notices/entities/ingestion-job.entity";
import type { ProcurementIngestionJobData } from "../producers/procurement-ingestion.producer";

export interface IngestionJobResult {
  created: number;
  updated: number;
  failed: number;
  errors: Array<{ secopId: string; reason: string }>;
}

type ChunkRecord = ProcurementIngestionJobData["records"][number];

/**
 * Entity-shaped plain object passed to TypeORM upsert.
 * Mirrors {@link ProcurementNotice} columns without the class instance overhead.
 */
interface EntityShape {
  secopId: string;
  source: string;
  title: string;
  description: string | null;
  status: string | null;
  entityName: string | null;
  entityNit: string | null;
  value: number | null;
  currency: string | null;
  publicationDate: Date | null;
  deadlineDate: Date | null;
  contractingModality: string | null;
  contractType: string | null;
  unspscCode: string | null;
  unspscGroup: string | null;
  unspscFamily: string | null;
  unspscClass: string | null;
  unspscName: string | null;
  department: string | null;
  location: string | null;
  awardedContractorNit: string | null;
  awardedContractorName: string | null;
  awardedValue: number | null;
  awardedDate: Date | null;
  processUrl: string | null;
  sourceLastUpdatedAt: Date | null;
  sourceMetadata: Record<string, unknown> | null;
  rawData: Record<string, unknown> | null;
}

/**
 * Pure ingestion logic extracted from the worker.
 *
 * This class is NOT registered as a BullMQ processor — it only holds the
 * algorithm. The actual sandboxed processor lives in
 * `processors/import-processor.ts` and runs in an isolated Bun worker thread.
 *
 * This class exists so the algorithm remains unit-testable without
 * spinning up BullMQ workers or TypeORM connections.
 */
export class ProcurementIngestionWorker {
  private readonly logger = new Logger(ProcurementIngestionWorker.name);
  readonly CHUNK_SIZE = 5000;

  constructor(
    @InjectRepository(ProcurementNotice)
    private readonly repository: Repository<ProcurementNotice>,
    @InjectRepository(IngestionJob)
    private readonly ingestionJobRepository: Repository<IngestionJob>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Public API ──────────────────────────────────────────────

  async process(
    ingestionJobId: string,
    records: ChunkRecord[],
  ): Promise<IngestionJobResult> {
    this.logger.log(`Processing ingestion job ${ingestionJobId} with ${records.length} records`);

    await this.markJobProcessing(ingestionJobId);

    const result: IngestionJobResult = { created: 0, updated: 0, failed: 0, errors: [] };
    const deduplicated = this.deduplicateRecords(records);
    const existingSet = await this.loadExistingSecopIds(deduplicated);

    await this.processChunks(deduplicated, existingSet, ingestionJobId, result);

    const finalStatus = this.resolveFinalStatus(result);
    await this.persistJobResult(ingestionJobId, result, finalStatus);

    this.logger.log(
      `Job ${ingestionJobId} complete: ${result.created} created, ${result.updated} updated, ${result.failed} failed`,
    );
    return result;
  }

  // ── Deduplication ───────────────────────────────────────────

  private deduplicateRecords(records: ChunkRecord[]): ChunkRecord[] {
    const map = new Map<string, ChunkRecord>();
    for (const record of records) {
      map.set(record.secopId, record);
    }
    return Array.from(map.values());
  }

  // ── Persistence helpers ─────────────────────────────────────

  private async markJobProcessing(ingestionJobId: string): Promise<void> {
    await this.ingestionJobRepository.update(ingestionJobId, {
      status: IngestionJobStatus.PROCESSING,
    });
  }

  private async loadExistingSecopIds(records: ChunkRecord[]): Promise<Set<string>> {
    const secopIds = records.map((r) => r.secopId);
    if (secopIds.length === 0) return new Set();

    const entities = await this.repository.find({
      where: secopIds.map((id) => ({ secopId: id })),
      select: ["secopId"],
    });
    return new Set(entities.map((e) => e.secopId));
  }

  private toEntityShape(record: ChunkRecord): EntityShape {
    return {
      secopId: record.secopId,
      source: record.source ?? "SECOP_II",
      title: record.title,
      description: record.description ?? null,
      status: record.status ?? null,
      entityName: record.entityName ?? null,
      entityNit: record.entityNit ?? null,
      value: record.value ?? null,
      currency: record.currency ?? null,
      publicationDate: record.publicationDate ? new Date(record.publicationDate) : null,
      deadlineDate: record.deadlineDate ? new Date(record.deadlineDate) : null,
      contractingModality: record.contractingModality ?? null,
      contractType: record.contractType ?? null,
      unspscCode: record.unspscCode ?? null,
      unspscGroup: record.unspscGroup ?? null,
      unspscFamily: record.unspscFamily ?? null,
      unspscClass: record.unspscClass ?? null,
      unspscName: record.unspscName ?? null,
      department: record.department ?? null,
      location: record.location ?? null,
      awardedContractorNit: record.awardedContractorNit ?? null,
      awardedContractorName: record.awardedContractorName ?? null,
      awardedValue: record.awardedValue ?? null,
      awardedDate: record.awardedDate ? new Date(record.awardedDate) : null,
      processUrl: record.processUrl ?? null,
      sourceLastUpdatedAt: record.sourceLastUpdatedAt
        ? new Date(record.sourceLastUpdatedAt)
        : null,
      sourceMetadata: record.sourceMetadata ?? null,
      rawData: record.sourceMetadata ?? null,
    };
  }

  // ── Chunk processing ────────────────────────────────────────

  private async processChunks(
    records: ChunkRecord[],
    existingSet: Set<string>,
    ingestionJobId: string,
    result: IngestionJobResult,
  ): Promise<void> {
    for (let i = 0; i < records.length; i += this.CHUNK_SIZE) {
      const chunk = records.slice(i, i + this.CHUNK_SIZE);
      await this.processOneChunk(chunk, existingSet, ingestionJobId, result);
    }
  }

  private async processOneChunk(
    chunk: ChunkRecord[],
    existingSet: Set<string>,
    ingestionJobId: string,
    result: IngestionJobResult,
  ): Promise<void> {
    try {
      const entities = chunk.map((record) => this.toEntityShape(record));
      await this.repository.upsert(entities as any, ["secopId"]);

      const persisted = await this.repository.find({
        where: chunk.map((r) => ({ secopId: r.secopId })),
        select: ["id", "secopId"],
      });

      this.countChunkResults(chunk, existingSet, result);
      this.emitChunkEvents(persisted, existingSet, ingestionJobId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Chunk failed: ${message}`);
      result.failed += chunk.length;
      for (const record of chunk) {
        result.errors.push({ secopId: record.secopId, reason: message });
      }
    }

    await this.persistIntermediateProgress(ingestionJobId, result);
  }

  private countChunkResults(
    chunk: ChunkRecord[],
    existingSet: Set<string>,
    result: IngestionJobResult,
  ): void {
    for (const record of chunk) {
      if (existingSet.has(record.secopId)) {
        result.updated++;
      } else {
        result.created++;
      }
    }
  }

  private emitChunkEvents(
    persisted: Array<{ id: string; secopId: string }>,
    existingSet: Set<string>,
    ingestionJobId: string,
  ): void {
    for (const notice of persisted) {
      this.eventEmitter.emit(
        NewProcurementNoticeEvent.EVENT_NAME,
        new NewProcurementNoticeEvent({
          ingestionJobId,
          procurementNoticeId: notice.id,
          secopId: notice.secopId,
          action: existingSet.has(notice.secopId) ? "updated" : "created",
        }),
      );
    }
  }

  // ── Result persistence ──────────────────────────────────────

  private async persistIntermediateProgress(
    ingestionJobId: string,
    result: IngestionJobResult,
  ): Promise<void> {
    await this.ingestionJobRepository.update(ingestionJobId, {
      createdCount: result.created,
      updatedCount: result.updated,
      failedCount: result.failed,
      errors: result.errors,
    });
  }

  private async persistJobResult(
    ingestionJobId: string,
    result: IngestionJobResult,
    status: IngestionJobStatus,
  ): Promise<void> {
    await this.ingestionJobRepository.update(ingestionJobId, {
      status,
      createdCount: result.created,
      updatedCount: result.updated,
      failedCount: result.failed,
      errors: result.errors,
    });
  }

  private resolveFinalStatus(result: IngestionJobResult): IngestionJobStatus {
    if (result.failed === 0) return IngestionJobStatus.COMPLETED;
    if (result.created > 0 || result.updated > 0) return IngestionJobStatus.PARTIAL;
    return IngestionJobStatus.FAILED;
  }
}
