import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { CreateProcurementNoticeDto } from './create-procurement-notice.dto';

/**
 * DTO for enqueueing a batch of procurement notices for ingestion.
 *
 * Records are processed asynchronously via BullMQ. Deduplication is
 * handled by `secopId`: records with the same `secopId` within the batch
 * count as duplicates, and already-persisted `secopId` values are skipped.
 *
 * @see procnotices-spec - Duplicate-safe Bulk Ingest
 */
export class BulkIngestionDto {
  /** Array of procurement notice records to ingest. Max 1000 per batch. */
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => CreateProcurementNoticeDto)
  records: CreateProcurementNoticeDto[];
}
