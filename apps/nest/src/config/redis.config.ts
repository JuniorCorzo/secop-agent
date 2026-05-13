import type { EnvironmentConfig } from './env.validation';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export const redisConfig = (env: Pick<EnvironmentConfig, 'REDIS_HOST' | 'REDIS_PORT' | 'REDIS_PASSWORD'>): RedisConfig => ({
  host: env.REDIS_HOST ?? 'localhost',
  port: env.REDIS_PORT ?? 6379,
  password: env.REDIS_PASSWORD ?? undefined,
});
