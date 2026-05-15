import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { QueuesModule } from '../src/modules/queues/queues.module';
import { ExampleQueueProducer } from '../src/modules/queues/producers/example-queue.producer';
import { ExampleQueueWorker } from '../src/modules/queues/workers/example-queue.worker';
import { IngestionJob } from '../src/modules/procurement-notices/entities/ingestion-job.entity';
import { QUEUE_NAMES } from '../src/modules/queues/constants/queue-names';
import { ProcurementNotice } from '../src/modules/procurement-notices/entities/procurement-notice.entity';

describe('ExampleQueue Integration', () => {
  it('enqueues, processes, and completes an example job', async () => {
    const addMock = jest.fn().mockResolvedValue({ id: 'job-1' });
    const queueMock = {
      add: addMock,
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 1,
        failed: 0,
      }),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              REDIS_HOST: 'localhost',
              REDIS_PORT: 6379,
              REDIS_PASSWORD: '',
            }),
          ],
        }),
        BullModule.forRoot({
          connection: {
            host: 'localhost',
            port: 6379,
          },
        }),
        EventEmitterModule.forRoot(),
        QueuesModule,
      ],
    })
      .overrideProvider(getQueueToken(QUEUE_NAMES.EXAMPLE))
      .useValue(queueMock)
      .overrideProvider(getRepositoryToken(ProcurementNotice))
      .useValue({
        find: jest.fn(),
        upsert: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(IngestionJob))
      .useValue({
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
      })
      .compile();

    const producer = moduleRef.get(ExampleQueueProducer);
    const worker = moduleRef.get(ExampleQueueWorker);

    // 1. Enqueue a valid example job
    const jobData = { message: 'integration-test', timestamp: Date.now() };
    const enqueued = await producer.add(jobData);
    expect(enqueued).toEqual({ id: 'job-1' });
    expect(addMock).toHaveBeenCalledWith(
      'example-job',
      expect.objectContaining(jobData),
      expect.any(Object),
    );

    // 2. Worker processes the job
    const job = {
      id: 'job-1',
      data: jobData,
    } as Job;
    const result = await worker.process(job);
    expect(result).toEqual({ processed: true });

    // 3. Verify onCompleted event handler exists and can be called
    const completedSpy = jest.spyOn(worker, 'onCompleted');
    worker.onCompleted(job);
    expect(completedSpy).toHaveBeenCalledWith(job);
  });
});
