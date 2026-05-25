import { IsArray, ArrayNotEmpty, ArrayMaxSize, IsUUID } from 'class-validator';

/**
 * Data Transfer Object for enqueuing a batch scoring job for a company.
 * Validates the list of procurement notice UUIDs before enqueueing.
 */
export class BatchScoringDto {
  /**
   * List of procurement notice UUIDs to score against the target company.
   * Must be non-empty and contain at most 100 entries.
   */
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  noticeIds: string[];
}
