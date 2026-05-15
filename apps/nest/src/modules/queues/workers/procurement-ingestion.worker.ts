import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../constants/queue-names';
import {
  IngestionJob,
  IngestionJobStatus,
} from '../../procurement-notices/entities/ingestion-job.entity';
import { NewProcurementNoticeEvent } from '../../procurement-notices/events/new-procurement-notice.event';
import { ProcurementNotice } from '../../procurement-notices/entities/procurement-notice.entity';
import { ProcurementIngestionJobData } from '../producers/procurement-ingestion.producer';

export interface IngestionJobResult {
  created: number;
  updated: number;
  failed: number;
  errors: Array<{ secopId: string; reason: string }>;
}

@Processor(QUEUE_NAMES.PROCUREMENT_NOTICE_INGESTION)
export class ProcurementIngestionWorker extends WorkerHost {
  private readonly logger = new Logger(ProcurementIngestionWorker.name);
  private readonly CHUNK_SIZE = 50;

  constructor(
    @InjectRepository(ProcurementNotice)
    private readonly repository: Repository<ProcurementNotice>,
    @InjectRepository(IngestionJob)
    private readonly ingestionJobRepository: Repository<IngestionJob>,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job<ProcurementIngestionJobData>): Promise<IngestionJobResult> {
    this.logger.log(
      `Processing procurement ingestion job ${job.id} with ${job.data.records.length} records`,
    );

    const result: IngestionJobResult = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    await this.ingestionJobRepository.update(job.data.ingestionJobId, {
      status: IngestionJobStatus.PROCESSING,
    });

    // Deduplicate by secopId (keep last occurrence)
    const recordMap = new Map<string, ProcurementIngestionJobData['records'][number]>();
    for (const record of job.data.records) {
      recordMap.set(record.secopId, record);
    }
    const deduplicatedRecords = Array.from(recordMap.values());

    // Find existing secopIds to distinguish created vs updated after upsert
    const secopIds = deduplicatedRecords.map((r) => r.secopId);
    const existingEntities =
      secopIds.length > 0
        ? await this.repository.find({
            where: secopIds.map((id) => ({ secopId: id })),
            select: ['secopId'],
          })
        : [];
    const existingSet = new Set(existingEntities.map((e) => e.secopId));

    // Process in chunks
    for (let i = 0; i < deduplicatedRecords.length; i += this.CHUNK_SIZE) {
      const chunk = deduplicatedRecords.slice(i, i + this.CHUNK_SIZE);

      try {
        const entities = chunk.map((record) => ({
          secopId: record.secopId,
          title: record.title,
          description: record.description ?? null,
          status: record.status ?? null,
          entityName: record.entityName ?? null,
          contactInfo: record.contactInfo ?? null,
          value: record.value ?? null,
          currency: record.currency ?? null,
          publicationDate: record.publicationDate
            ? new Date(record.publicationDate)
            : null,
          deadlineDate: record.deadlineDate
            ? new Date(record.deadlineDate)
            : null,
          sector: record.sector ?? null,
          location: record.location ?? null,
          sourceMetadata: record.sourceMetadata ?? null,
          rawData: record.sourceMetadata ?? null,
        }));

        // TypeORM upsert typing is strict about jsonb columns; cast is safe here
        // because the plain object shape matches the entity schema exactly.
        await this.repository.upsert(entities as any, ['secopId']);

        const persistedNotices = await this.repository.find({
          where: chunk.map((record) => ({ secopId: record.secopId })),
          select: ['id', 'secopId'],
        });

        for (const record of chunk) {
          if (existingSet.has(record.secopId)) {
            result.updated++;
          } else {
            result.created++;
          }
        }

        for (const notice of persistedNotices) {
          this.eventEmitter.emit(
            NewProcurementNoticeEvent.EVENT_NAME,
            new NewProcurementNoticeEvent({
              ingestionJobId: job.data.ingestionJobId,
              procurementNoticeId: notice.id,
              secopId: notice.secopId,
              action: existingSet.has(notice.secopId) ? 'updated' : 'created',
            }),
          );
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Chunk failed in job ${job.id}: ${message}`);
        result.failed += chunk.length;
        for (const record of chunk) {
          result.errors.push({
            secopId: record.secopId,
            reason: message,
          });
        }
      }

      await this.ingestionJobRepository.update(job.data.ingestionJobId, {
        createdCount: result.created,
        updatedCount: result.updated,
        failedCount: result.failed,
        errors: result.errors,
      });
    }

    const finalStatus =
      result.failed === 0
        ? IngestionJobStatus.COMPLETED
        : result.created > 0 || result.updated > 0
          ? IngestionJobStatus.PARTIAL
          : IngestionJobStatus.FAILED;

    await this.ingestionJobRepository.update(job.data.ingestionJobId, {
      status: finalStatus,
      createdCount: result.created,
      updatedCount: result.updated,
      failedCount: result.failed,
      errors: result.errors,
    });

    this.logger.log(
      `Job ${job.id} complete: ${result.created} created, ${result.updated} updated, ${result.failed} failed`,
    );
    return result;
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.log(`Procurement ingestion job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Procurement ingestion job ${job.id} failed: ${error.message}`,
    );
  }
}
