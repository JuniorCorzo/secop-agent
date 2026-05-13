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

export class CreateProcurementNoticeDto {
  @IsString()
  @Length(1, 64)
  secopId: string;

  @IsString()
  @MaxLength(512)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

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

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  value?: number;

  @IsOptional()
  @IsString()
  @Length(1, 8)
  currency?: string;

  @IsOptional()
  @IsDateString()
  publicationDate?: string;

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

  @IsOptional()
  @IsObject()
  sourceMetadata?: Record<string, unknown>;
}
