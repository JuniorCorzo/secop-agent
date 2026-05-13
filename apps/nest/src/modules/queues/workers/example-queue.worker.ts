import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../constants/queue-names';
import type { ExampleJobData } from '../producers/example-queue.producer';

@Processor(QUEUE_NAMES.EXAMPLE)
export class ExampleQueueWorker extends WorkerHost {
  private readonly logger = new Logger(ExampleQueueWorker.name);

  async process(job: Job<ExampleJobData>): Promise<{ processed: true }> {
    this.logger.log(`Processing example job ${job.id}: ${job.data.message}`);
    return { processed: true };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.log(`Example job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Example job ${job.id} failed: ${error.message}`);
  }
}
