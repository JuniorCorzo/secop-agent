import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { QueuesModule } from '../src/modules/queues/queues.module';
import { ProcurementIngestionProducer } from '../src/modules/queues/producers/procurement-ingestion.producer';
import { ProcurementIngestionWorker } from '../src/modules/queues/workers/procurement-ingestion.worker';
import { QUEUE_NAMES } from '../src/modules/queues/constants/queue-names';
import { IngestionJob } from '../src/modules/procurement-notices/entities/ingestion-job.entity';
import { ProcurementNotice } from '../src/modules/procurement-notices/entities/procurement-notice.entity';

describe('Procurement Ingestion Integration', () => {
  it('enqueues a bulk job, processes it, and returns correct result counts', async () => {
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

    const upsertMock = jest.fn().mockResolvedValue(undefined);
    const findMock = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'uuid-1', secopId: 'SECOP-001' },
        { id: 'uuid-2', secopId: 'SECOP-002' },
      ]);

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
      .overrideProvider(getQueueToken(QUEUE_NAMES.PROCUREMENT_NOTICE_INGESTION))
      .useValue(queueMock)
      .overrideProvider(getRepositoryToken(ProcurementNotice))
      .useValue({
        find: findMock,
        upsert: upsertMock,
      })
      .overrideProvider(getRepositoryToken(IngestionJob))
      .useValue({
        update: jest.fn(),
      })
      .compile();

    const producer = moduleRef.get(ProcurementIngestionProducer);
    const worker = moduleRef.get(ProcurementIngestionWorker);

    // 1. Enqueue a valid bulk ingestion job
    const jobData = {
      ingestionJobId: '11111111-1111-4111-8111-111111111111',
      records: [
        { secopId: 'SECOP-001', title: 'Notice 1' },
        { secopId: 'SECOP-002', title: 'Notice 2' },
      ],
    };
    const enqueued = await producer.add(jobData);
    expect(enqueued).toEqual({ id: 'job-1' });
    expect(addMock).toHaveBeenCalledWith(
      'procurement-ingestion',
      expect.objectContaining(jobData),
      expect.any(Object),
    );

    // 2. Worker processes the job
    const job = {
      id: 'job-1',
      data: jobData,
    } as Job;
    const result = await worker.process(job);
    expect(result.created).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);

    // 3. Verify repository upsert was called with correct conflict keys
    expect(upsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ secopId: 'SECOP-001', title: 'Notice 1' }),
        expect.objectContaining({ secopId: 'SECOP-002', title: 'Notice 2' }),
      ]),
      ['secopId'],
    );

    // 4. Verify onCompleted event handler exists and can be called
    const completedSpy = jest.spyOn(worker, 'onCompleted');
    worker.onCompleted(job);
    expect(completedSpy).toHaveBeenCalledWith(job);
  });

  it('upserts existing records by secopId without creating duplicates', async () => {
    const addMock = jest.fn().mockResolvedValue({ id: 'job-2' });
    const queueMock = { add: addMock };

    const upsertMock = jest.fn().mockResolvedValue(undefined);
    const findMock = jest
      .fn()
      .mockResolvedValueOnce([{ secopId: 'SECOP-001' }])
      .mockResolvedValueOnce([
        { id: 'uuid-1', secopId: 'SECOP-001' },
        { id: 'uuid-2', secopId: 'SECOP-002' },
      ]);

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
      .overrideProvider(getQueueToken(QUEUE_NAMES.PROCUREMENT_NOTICE_INGESTION))
      .useValue(queueMock)
      .overrideProvider(getRepositoryToken(ProcurementNotice))
      .useValue({
        find: findMock,
        upsert: upsertMock,
      })
      .overrideProvider(getRepositoryToken(IngestionJob))
      .useValue({
        update: jest.fn(),
      })
      .compile();

    const worker = moduleRef.get(ProcurementIngestionWorker);

    const job = {
      id: 'job-2',
      data: {
        ingestionJobId: '22222222-2222-4222-8222-222222222222',
        records: [
          { secopId: 'SECOP-001', title: 'Updated Notice' },
          { secopId: 'SECOP-002', title: 'New Notice' },
        ],
      },
    } as Job;

    const result = await worker.process(job);

    // One existing → updated, one new → created
    expect(result.updated).toBe(1);
    expect(result.created).toBe(1);
    expect(result.failed).toBe(0);

    // Upsert should have been called with conflict key secopId
    expect(upsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ secopId: 'SECOP-001', title: 'Updated Notice' }),
        expect.objectContaining({ secopId: 'SECOP-002', title: 'New Notice' }),
      ]),
      ['secopId'],
    );
  });
});
