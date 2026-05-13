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

export class SearchProcurementNoticeDto {
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

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @IsIn(PROCUREMENT_NOTICE_STATUSES)
  status?: ProcurementNoticeStatus;

  @IsOptional()
  @IsIn(PROCUREMENT_NOTICE_SORT_FIELDS)
  sortBy?: (typeof PROCUREMENT_NOTICE_SORT_FIELDS)[number] = 'createdAt';

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

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;
}
