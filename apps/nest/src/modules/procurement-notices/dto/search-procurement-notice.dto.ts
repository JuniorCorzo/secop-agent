import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  MaxLength,
  IsIn,
} from 'class-validator';
import {
  PROCUREMENT_NOTICE_STATUSES,
  ProcurementNoticeStatus,
  PROCUREMENT_NOTICE_SORT_FIELDS,
  PROCUREMENT_NOTICE_SORT_ORDERS,
} from '../procurement-notice.types';

/**
 * Query DTO for searching and listing procurement notices.
 *
 * All filters are optional. When no filters are provided, all non-deleted records
 * are returned ordered by `createdAt DESC`. Text search (`query`) spans `title`,
 * `secopId`, `entityName`, `sector`, and `location` using ILIKE.
 *
 * @see procnotices-spec - Search and Pagination
 */
export class SearchProcurementNoticeDto {
  /** Free-text search across multiple ILIKE-able columns. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  query?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  secopId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  entityName?: string;

  /**
   * Filter by exact lifecycle status. Invalid values are rejected by `class-validator`.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @IsIn(PROCUREMENT_NOTICE_STATUSES)
  status?: ProcurementNoticeStatus;

  /** Sort column. Defaults to `createdAt`. */
  @IsOptional()
  @IsIn(PROCUREMENT_NOTICE_SORT_FIELDS)
  sortBy?: (typeof PROCUREMENT_NOTICE_SORT_FIELDS)[number] = 'createdAt';

  /** Sort direction. Defaults to `DESC`. */
  @IsOptional()
  @IsIn(PROCUREMENT_NOTICE_SORT_ORDERS)
  order?: (typeof PROCUREMENT_NOTICE_SORT_ORDERS)[number] = 'DESC';

  @IsOptional()
  @IsString()
  @MaxLength(256)
  sector?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  location?: string;

  /** Page number (1-based). Defaults to 1. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  /** Records per page. Defaults to 20. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;
}
