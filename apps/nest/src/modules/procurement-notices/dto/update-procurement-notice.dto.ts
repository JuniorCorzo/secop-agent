import { PartialType } from '@nestjs/swagger';
import { CreateProcurementNoticeDto } from './create-procurement-notice.dto';

export class UpdateProcurementNoticeDto extends PartialType(CreateProcurementNoticeDto) {}
