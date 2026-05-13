import { Test } from '@nestjs/testing';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Queue, Worker, Job } from 'bullmq';
import { ExampleQueueProducer } from '../src/modules/queues/producers/example-queue.producer';
import { QUEUE_NAMES } from '../src/modules/queues/constants/queue-names';

async function waitForState(
  job: Job,
  targetState: 'completed' | 'failed',
  timeoutMs = 5000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(async () => {
      const state = await job.getState();
      if (state === targetState) {
        clearInterval(interval);
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error(`Timeout waiting for job ${job.id} to reach ${targetState}`));
      }
    }, 50);
  });
}

describe('BullMQ Terminal States (real Redis via producer defaults)', () => {
  const connection = { host: 'localhost', port: 6379 };
  let moduleRef: any;
  let producer: ExampleQueueProducer;
  let queue: Queue;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        BullModule.forRoot({ connection }),
        BullModule.registerQueue({ name: QUEUE_NAMES.EXAMPLE }),
      ],
      providers: [ExampleQueueProducer],
    }).compile();

    producer = moduleRef.get(ExampleQueueProducer);
    queue = moduleRef.get(getQueueToken(QUEUE_NAMES.EXAMPLE));
    await queue.waitUntilReady();
    await queue.obliterate({ force: true }).catch(() => {});
  });

  beforeEach(async () => {
    await queue?.obliterate({ force: true }).catch(() => {});
  });

  afterAll(async () => {
    await queue?.obliterate({ force: true }).catch(() => {});
    await queue?.close();
    await moduleRef?.close();
  });

  describe('completed terminal state', () => {
    let worker: Worker;

    afterEach(async () => {
      await worker?.close();
    });

    it('reaches completed state after successful processing with producer defaults', async () => {
      worker = new Worker(
        QUEUE_NAMES.EXAMPLE,
        async (job) => {
          return { processed: true, jobId: job.id, input: job.data.message };
        },
        { connection },
      );

      const job = await producer.add({
        message: 'terminal-test',
        timestamp: Date.now(),
      });
      expect(job.id).toBeDefined();

      // Prove producer defaults were applied
      expect(job.opts.attempts).toBe(3);
      expect(job.opts.backoff).toEqual({ type: 'exponential', delay: 2000 });

      await waitForState(job, 'completed');

      // Re-fetch from Redis so cached properties reflect the terminal state
      const finished = await queue.getJob(job.id!);
      expect(finished).not.toBeNull();

      const state = await finished!.getState();
      expect(state).toBe('completed');

      expect(finished!.returnvalue).toEqual({
        processed: true,
        jobId: finished!.id,
        input: 'terminal-test',
      });

      const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed');
      expect(counts.completed).toBe(1);
      expect(counts.failed).toBe(0);
    });
  });

  describe('failed terminal state after retry exhaustion', () => {
    let worker: Worker;

    afterEach(async () => {
      await worker?.close();
    });

    it(
      'reaches failed state after exhausting producer default retries',
      async () => {
        let processAttempts = 0;

        worker = new Worker(
          QUEUE_NAMES.EXAMPLE,
          async () => {
            processAttempts++;
            throw new Error('Intentional retryable failure');
          },
          { connection },
        );

        const job = await producer.add({
          message: 'fail-test',
          timestamp: Date.now(),
        });
        expect(job.id).toBeDefined();

        // Prove producer defaults were applied
        expect(job.opts.attempts).toBe(3);
        expect(job.opts.backoff).toEqual({ type: 'exponential', delay: 2000 });

        await waitForState(job, 'failed', 12000);

        // Re-fetch from Redis so cached properties reflect the terminal state
        const finished = await queue.getJob(job.id!);
        expect(finished).not.toBeNull();

        const state = await finished!.getState();
        expect(state).toBe('failed');

        expect(processAttempts).toBe(3);
        expect(finished!.attemptsMade).toBe(3);
        expect(finished!.failedReason).toBe('Intentional retryable failure');

        const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed');
        expect(counts.failed).toBe(1);
        expect(counts.completed).toBe(0);
      },
      15000,
    );
  });
});
