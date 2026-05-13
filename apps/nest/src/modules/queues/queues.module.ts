import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from './constants/queue-names';
import { ExampleQueueProducer } from './producers/example-queue.producer';
import { ExampleQueueWorker } from './workers/example-queue.worker';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST') ?? 'localhost',
          port: configService.get<number>('REDIS_PORT') ?? 6379,
          password: configService.get<string>('REDIS_PASSWORD') ?? undefined,
        },
      }),
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.EXAMPLE,
    }),
  ],
  providers: [ExampleQueueProducer, ExampleQueueWorker],
  exports: [BullModule, ExampleQueueProducer],
})
export class QueuesModule {}
