import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IsIn, IsString, IsUUID, Length } from 'class-validator';
import { BaseQueueProducer } from './base-queue.producer';
import { QUEUE_NAMES } from '../constants/queue-names';

export class ScoringDispatchJobData {
  @IsUUID()
  procurementNoticeId: string;

  @IsString()
  @Length(1, 64)
  secopId: string;

  @IsString()
  @IsIn(['NewProcurementNoticeEvent'])
  sourceEvent: 'NewProcurementNoticeEvent';
}

@Injectable()
export class ScoringDispatchProducer extends BaseQueueProducer<ScoringDispatchJobData> {
  protected readonly jobName = 'scoring-dispatch';
  protected readonly dataClass = ScoringDispatchJobData;

  constructor(
    @InjectQueue(QUEUE_NAMES.SCORING)
    protected readonly queue: Queue,
  ) {
    super();
  }
}
