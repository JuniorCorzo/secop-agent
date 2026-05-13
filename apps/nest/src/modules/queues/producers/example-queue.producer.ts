import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IsString, IsNumber } from 'class-validator';
import { BaseQueueProducer } from './base-queue.producer';
import { QUEUE_NAMES } from '../constants/queue-names';

export class ExampleJobData {
  @IsString()
  message: string;

  @IsNumber()
  timestamp: number;
}

@Injectable()
export class ExampleQueueProducer extends BaseQueueProducer<ExampleJobData> {
  protected readonly jobName = 'example-job';
  protected readonly dataClass = ExampleJobData;

  constructor(
    @InjectQueue(QUEUE_NAMES.EXAMPLE) protected readonly queue: Queue,
  ) {
    super();
  }
}
