import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../queues/constants/queue-names';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUE_NAMES.EXAMPLE,
    }),
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
