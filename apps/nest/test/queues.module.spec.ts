import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { QueuesModule } from '../src/modules/queues/queues.module';
import { ExampleQueueProducer } from '../src/modules/queues/producers/example-queue.producer';
import { ExampleQueueWorker } from '../src/modules/queues/workers/example-queue.worker';
import { QUEUE_NAMES } from '../src/modules/queues/constants/queue-names';

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
      .compile();

    expect(moduleRef.get(ExampleQueueProducer)).toBeDefined();
    expect(moduleRef.get(ExampleQueueWorker)).toBeDefined();
  });
});
