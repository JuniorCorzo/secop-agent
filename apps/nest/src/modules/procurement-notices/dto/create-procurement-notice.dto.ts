import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  MaxLength,
  Length,
} from 'class-validator';

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
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  entityName?: string;

  @IsOptional()
  @IsString()
  contactInfo?: string;

  @IsOptional()
  @IsNumber()
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
  sourceMetadata?: Record<string, unknown>;
}
