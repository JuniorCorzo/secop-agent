import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  MaxLength,
  Length,
  IsObject,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PROCUREMENT_NOTICE_STATUSES,
  ProcurementNoticeStatus,
} from '../procurement-notice.types';

/**
 * Input DTO for creating a single procurement notice.
 *
 * Only `secopId` and `title` are required. All other fields are optional and
 * default to `null` or `undefined` in the persistence layer. Dates are received
 * as ISO strings and converted to `Date` instances by the service.
 *
 * @see procnotices-spec - Persisted Procurement Notice Record
 */
export class CreateProcurementNoticeDto {
  /** Stable SECOP identifier. Must be unique across all notices. 1-64 chars. */
  @IsString()
  @Length(1, 64)
  secopId: string;

  /** Human-readable notice title. Max 512 chars. */
  @IsString()
  @MaxLength(512)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  /**
   * Initial lifecycle state. Must be a valid {@link ProcurementNoticeStatus}.
   * Defaults to `PENDING` if omitted.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @IsIn(PROCUREMENT_NOTICE_STATUSES)
  status?: ProcurementNoticeStatus;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  entityName?: string;

  @IsOptional()
  @IsString()
  contactInfo?: string;

  /**
   * Estimated contract value. Transformed from string to number by `class-transformer`.
   * Stored as `decimal(18,2)`.
   */
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  value?: number;

  /** ISO 4217 currency code, 1-8 chars (e.g., `COP`). */
  @IsOptional()
  @IsString()
  @Length(1, 8)
  currency?: string;

  /** ISO-8601 date string. Converted to `Date` by the service. */
  @IsOptional()
  @IsDateString()
  publicationDate?: string;

  /** ISO-8601 date string. Converted to `Date` by the service. */
  @IsOptional()
  @IsDateString()
  deadlineDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  sector?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  location?: string;

  /** Arbitrary JSON metadata from the SECOP source. Preserved as-is. */
  @IsOptional()
  @IsObject()
  sourceMetadata?: Record<string, unknown>;
}
