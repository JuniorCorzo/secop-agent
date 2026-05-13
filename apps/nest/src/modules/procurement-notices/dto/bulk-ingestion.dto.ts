import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { CreateProcurementNoticeDto } from './create-procurement-notice.dto';

export class BulkIngestionDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => CreateProcurementNoticeDto)
  records: CreateProcurementNoticeDto[];
}
