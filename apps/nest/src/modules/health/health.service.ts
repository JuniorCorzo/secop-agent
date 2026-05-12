import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { checkHttpHealth, checkLlmHealth } from './indicators/http.indicator';
import { checkPostgresHealth } from './indicators/postgres.indicator';
import { checkRedisHealth } from './indicators/redis.indicator';

@Injectable()
export class HealthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async check() {
    const [database, redis, hermes, llm] = await Promise.all([
      checkPostgresHealth(this.dataSource),
      checkRedisHealth(this.configService),
      checkHttpHealth('hermes', this.configService.get<string>('HERMES_BASE_URL')),
      checkLlmHealth(
        this.configService.get<string>('LLM_BASE_URL'),
        this.configService.get<string>('LLM_API_KEY'),
      ),
    ]);

    const checks = { database, redis, hermes, llm };
    const down = Object.values(checks).some((check) => check.status !== 'up');

    return {
      status: down ? 'degraded' : 'ok',
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
