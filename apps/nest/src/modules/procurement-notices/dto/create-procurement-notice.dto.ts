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
  PROCUREMENT_NOTICE_SOURCES,
  ProcurementNoticeStatus,
  ProcurementNoticeSource,
} from '../procurement-notice.types';

/**
 * Input DTO for creating a single procurement notice.
 *
 * Unified contract for both SECOP-I and SECOP-II records. Fields absent in a
 * given source are omitted (default to `null` in the persistence layer).
 * Dates are received as ISO strings and converted to `Date` by the service.
 *
 * @see procnotices-spec - Persisted Procurement Notice Record
 */
export class CreateProcurementNoticeDto {
  /** Stable SECOP identifier. Must be unique across all notices. 1-64 chars. */
  @IsString()
  @Length(1, 64)
  secopId: string;

  /**
   * Origin dataset. Required to determine which fields are available.
   * SECOP_I = historical contracts | SECOP_II = active pipeline.
   * Optional for manual/external ingestion — defaults to SECOP_II if omitted.
   */
  @IsOptional()
  @IsString()
  @IsIn(PROCUREMENT_NOTICE_SOURCES)
  source?: ProcurementNoticeSource;

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

  /** NIT (tax ID) of the contracting entity. Used for competitive intelligence. */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  entityNit?: string;

  /**
   * Estimated/base contract value. Transformed from string to number by `class-transformer`.
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

  /**
   * Submission deadline. Only available for SECOP-II records.
   * ISO-8601 date string.
   */
  @IsOptional()
  @IsDateString()
  deadlineDate?: string;

  /** Contracting modality (e.g., Licitación Pública, Contratación Directa). */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  contractingModality?: string;

  /** Contract type (e.g., Obra, Prestación de Servicios, Suministro). */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  contractType?: string;

  /**
   * UNSPSC classification code.
   * SECOP-I: level-3 class code | SECOP-II: `codigo_principal_de_categoria`
   */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  unspscCode?: string;

  /** UNSPSC level-1 group name. Only available for SECOP-I records. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  unspscGroup?: string;

  /** UNSPSC level-2 family name. Only available for SECOP-I records. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  unspscFamily?: string;

  /** UNSPSC level-3 class name. Only available for SECOP-I records. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  unspscClass?: string;

  /** Human-readable UNSPSC object name. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  unspscName?: string;

  /** Geographic department of the contracting entity. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  department?: string;

  /** City/municipality of the contracting entity or execution location. */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  location?: string;

  /** NIT of the awarded contractor. Used for competitive intelligence. */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  awardedContractorNit?: string;

  /** Name of the awarded contractor. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  awardedContractorName?: string;

  /** Final awarded contract value. Stored as `decimal(18,2)`. */
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  awardedValue?: number;

  /** Date the contract was awarded/signed. ISO-8601 date string. */
  @IsOptional()
  @IsDateString()
  awardedDate?: string;

  /** Direct URL to the process in the SECOP platform. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  processUrl?: string;

  /**
   * Last modification timestamp from the source dataset.
   * Used by the ingestion scheduler for incremental fetching.
   * ISO-8601 datetime string.
   */
  @IsOptional()
  @IsDateString()
  sourceLastUpdatedAt?: string;

  /** Arbitrary JSON metadata from the SECOP source. Preserved as-is. */
  @IsOptional()
  @IsObject()
  sourceMetadata?: Record<string, unknown>;
}
