import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IsArray, ArrayNotEmpty, ArrayMaxSize, IsUUID } from 'class-validator';
import { BaseQueueProducer } from './base-queue.producer';
import { QUEUE_NAMES } from '../constants/queue-names';

export class CompanyScoringBatchJobData {
  @IsUUID()
  companyId: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  noticeIds: string[];
}

@Injectable()
export class CompanyScoringBatchProducer extends BaseQueueProducer<CompanyScoringBatchJobData> {
  protected readonly jobName = 'company-batch-scoring';
  protected readonly dataClass = CompanyScoringBatchJobData;

  constructor(
    @InjectQueue(QUEUE_NAMES.SCORING)
    protected readonly queue: Queue,
  ) {
    super();
  }
}
