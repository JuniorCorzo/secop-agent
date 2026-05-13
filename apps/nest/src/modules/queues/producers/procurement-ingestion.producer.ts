import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IsArray, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseQueueProducer } from './base-queue.producer';
import { QUEUE_NAMES } from '../constants/queue-names';
import { CreateProcurementNoticeDto } from '../../procurement-notices/dto/create-procurement-notice.dto';

export class ProcurementIngestionJobData {
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => CreateProcurementNoticeDto)
  records: CreateProcurementNoticeDto[];
}

@Injectable()
export class ProcurementIngestionProducer extends BaseQueueProducer<ProcurementIngestionJobData> {
  protected readonly jobName = 'procurement-ingestion';
  protected readonly dataClass = ProcurementIngestionJobData;

  constructor(
    @InjectQueue(QUEUE_NAMES.PROCUREMENT_NOTICE_INGESTION)
    protected readonly queue: Queue,
  ) {
    super();
  }
}
