import { Job } from 'bullmq';
import { ExampleQueueWorker } from '../src/modules/queues/workers/example-queue.worker';

describe('ExampleQueueWorker', () => {
  it('processes example job and returns processed flag', async () => {
    const worker = new ExampleQueueWorker();
    const job = {
      id: 'job-1',
      data: { message: 'hello', timestamp: Date.now() },
    } as Job;

    const result = await worker.process(job);

    expect(result).toEqual({ processed: true });
  });
});
