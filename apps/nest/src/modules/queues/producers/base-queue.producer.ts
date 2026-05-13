import { Injectable, BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Queue, Job, JobsOptions } from 'bullmq';

@Injectable()
export abstract class BaseQueueProducer<T extends object> {
  protected abstract readonly queue: Queue;
  protected abstract readonly jobName: string;
  protected readonly dataClass?: new () => T;

  async add(data: T, opts?: JobsOptions): Promise<Job<T>> {
    if (this.dataClass) {
      const instance = plainToInstance(this.dataClass, data);
      const errors = await validate(instance);
      if (errors.length > 0) {
        const messages = errors
          .map((e) => Object.values(e.constraints ?? {}).join(', '))
          .filter(Boolean)
          .join('; ');
        throw new BadRequestException(`Invalid job payload: ${messages}`);
      }
    }

    return this.queue.add(this.jobName, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      ...opts,
    });
  }
}
