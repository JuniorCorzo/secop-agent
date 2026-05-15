import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QUEUE_NAMES } from './constants/queue-names';
import { ExampleQueueProducer } from './producers/example-queue.producer';
import { ExampleQueueWorker } from './workers/example-queue.worker';
import { ProcurementIngestionProducer } from './producers/procurement-ingestion.producer';
import { ScoringDispatchProducer } from './producers/scoring-dispatch.producer';
import { ProcurementIngestionWorker } from './workers/procurement-ingestion.worker';
import { IngestionJob } from '../procurement-notices/entities/ingestion-job.entity';
import { ProcurementNotice } from '../procurement-notices/entities/procurement-notice.entity';

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
    BullModule.registerQueue(
      { name: QUEUE_NAMES.EXAMPLE },
      { name: QUEUE_NAMES.PROCUREMENT_NOTICE_INGESTION },
      { name: QUEUE_NAMES.SCORING },
    ),
    TypeOrmModule.forFeature([ProcurementNotice, IngestionJob]),
  ],
  providers: [
    ExampleQueueProducer,
    ExampleQueueWorker,
    ProcurementIngestionProducer,
    ScoringDispatchProducer,
    ProcurementIngestionWorker,
  ],
  exports: [BullModule, ExampleQueueProducer, ProcurementIngestionProducer, ScoringDispatchProducer],
})
export class QueuesModule {}
