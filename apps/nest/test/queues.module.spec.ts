import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueuesModule } from '../src/modules/queues/queues.module';
import { ExampleQueueProducer } from '../src/modules/queues/producers/example-queue.producer';
import { ExampleQueueWorker } from '../src/modules/queues/workers/example-queue.worker';
import { ScoringDispatchProducer } from '../src/modules/queues/producers/scoring-dispatch.producer';
import { QUEUE_NAMES } from '../src/modules/queues/constants/queue-names';
import { IngestionJob } from '../src/modules/procurement-notices/entities/ingestion-job.entity';
import { ProcurementNotice } from '../src/modules/procurement-notices/entities/procurement-notice.entity';

describe('QueuesModule', () => {
  it('wires queue providers and worker', async () => {
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
      .useValue({
        add: jest.fn(),
        getJobCounts: jest.fn().mockResolvedValue({
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
        }),
      })
      .overrideProvider(getQueueToken(QUEUE_NAMES.SCORING))
      .useValue({
        add: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(ProcurementNotice))
      .useValue({
        find: jest.fn(),
        upsert: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(IngestionJob))
      .useValue({
        create: jest.fn(),
        save: jest.fn(),
      })
      .compile();

    expect(moduleRef.get(ExampleQueueProducer)).toBeDefined();
    expect(moduleRef.get(ExampleQueueWorker)).toBeDefined();
    expect(moduleRef.get(ScoringDispatchProducer)).toBeDefined();
  });
});
