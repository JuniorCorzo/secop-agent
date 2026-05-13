import { Test } from '@nestjs/testing';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Queue, Worker, Job } from 'bullmq';
import { ProcurementIngestionProducer } from '../src/modules/queues/producers/procurement-ingestion.producer';

const TEST_QUEUE_NAME = 'test-procurement-terminal';

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

describe('Procurement Ingestion Terminal States (real Redis)', () => {
  const connection = { host: 'localhost', port: 6379 };
  let moduleRef: any;
  let producer: ProcurementIngestionProducer;
  let queue: Queue;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        BullModule.forRoot({ connection }),
        BullModule.registerQueue({ name: TEST_QUEUE_NAME }),
      ],
      providers: [
        {
          provide: ProcurementIngestionProducer,
          useFactory: (q: Queue) => new ProcurementIngestionProducer(q),
          inject: [getQueueToken(TEST_QUEUE_NAME)],
        },
      ],
    }).compile();

    producer = moduleRef.get(ProcurementIngestionProducer);
    queue = moduleRef.get(getQueueToken(TEST_QUEUE_NAME));
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

    it('reaches completed after successful processing with producer defaults', async () => {
      worker = new Worker(
        TEST_QUEUE_NAME,
        async (job) => {
          return {
            created: job.data.records.length,
            updated: 0,
            failed: 0,
            errors: [],
          };
        },
        { connection },
      );

      const job = await producer.add({
        records: [{ secopId: 'SECOP-001', title: 'Terminal Test' }],
      });
      expect(job.id).toBeDefined();
      expect(job.opts.attempts).toBe(3);
      expect(job.opts.backoff).toEqual({ type: 'exponential', delay: 2000 });

      await waitForState(job, 'completed');

      const finished = await queue.getJob(job.id!);
      expect(finished).not.toBeNull();
      expect(await finished!.getState()).toBe('completed');
      expect(finished!.returnvalue).toEqual({
        created: 1,
        updated: 0,
        failed: 0,
        errors: [],
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
      'reaches failed after exhausting producer default retries',
      async () => {
        let processAttempts = 0;

        worker = new Worker(
          TEST_QUEUE_NAME,
          async () => {
            processAttempts++;
            throw new Error('Intentional ingestion failure');
          },
          { connection },
        );

        const job = await producer.add({
          records: [{ secopId: 'SECOP-FAIL', title: 'Fail Test' }],
        });
        expect(job.id).toBeDefined();
        expect(job.opts.attempts).toBe(3);
        expect(job.opts.backoff).toEqual({ type: 'exponential', delay: 2000 });

        await waitForState(job, 'failed', 12000);

        const finished = await queue.getJob(job.id!);
        expect(finished).not.toBeNull();
        expect(await finished!.getState()).toBe('failed');
        expect(processAttempts).toBe(3);
        expect(finished!.attemptsMade).toBe(3);
        expect(finished!.failedReason).toBe('Intentional ingestion failure');

        const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed');
        expect(counts.failed).toBe(1);
        expect(counts.completed).toBe(0);
      },
      15000,
    );
  });
});
