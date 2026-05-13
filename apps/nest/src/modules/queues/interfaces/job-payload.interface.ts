import type { JobsOptions } from 'bullmq';

export interface QueueJob<T> {
  name: string;
  data: T;
  opts?: JobsOptions;
}
