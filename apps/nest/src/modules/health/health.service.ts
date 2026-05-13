import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { DataSource } from 'typeorm';
import type { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../queues/constants/queue-names';
import { checkHttpHealth, checkLlmHealth } from './indicators/http.indicator';
import { checkPostgresHealth } from './indicators/postgres.indicator';
import { checkRedisHealth } from './indicators/redis.indicator';
import { checkQueueHealth } from './indicators/queue.indicator';

@Injectable()
export class HealthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    @InjectQueue(QUEUE_NAMES.EXAMPLE) private readonly exampleQueue: Queue,
  ) {}

  async check() {
    const [database, redis, hermes, llm, queue] = await Promise.all([
      checkPostgresHealth(this.dataSource),
      checkRedisHealth(this.configService),
      checkHttpHealth('hermes', this.configService.get<string>('HERMES_BASE_URL')),
      checkLlmHealth(
        this.configService.get<string>('LLM_BASE_URL'),
        this.configService.get<string>('LLM_API_KEY'),
      ),
      checkQueueHealth(this.exampleQueue),
    ]);

    const checks = { database, redis, hermes, llm, queue };
    const down = Object.values(checks).some((check) => check.status !== 'up');

    return {
      status: down ? 'degraded' : 'ok',
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
