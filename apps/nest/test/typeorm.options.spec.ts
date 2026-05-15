import { ConfigService } from '@nestjs/config';
import { createTypeOrmOptions } from '../src/config/typeorm.options';
import { IngestionJob } from '../src/modules/procurement-notices/entities/ingestion-job.entity';

describe('createTypeOrmOptions', () => {
  it('maps validated config to TypeORM options', () => {
    const configService = {
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          DB_HOST: 'db',
          DB_PORT: 5432,
          DB_USERNAME: 'user',
          DB_PASSWORD: 'pass',
          DB_NAME: 'secop',
        };
        return values[key];
      }),
      get: jest.fn((key: string) => (key === 'DB_SCHEMA' ? 'public' : key === 'DB_SSL' || key === 'DB_LOGGING' ? false : undefined)),
    } as never as ConfigService;

    const options = createTypeOrmOptions(configService);

    expect(options.host).toBe('db');
    expect(options.port).toBe(5432);
    expect(options.database).toBe('secop');
    expect(options.synchronize).toBe(false);
  });

  it('registers IngestionJob in runtime entities', () => {
    const configService = {
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          DB_HOST: 'db',
          DB_PORT: 5432,
          DB_USERNAME: 'user',
          DB_PASSWORD: 'pass',
          DB_NAME: 'secop',
        };
        return values[key];
      }),
      get: jest.fn((key: string) =>
        key === 'DB_SCHEMA' ? 'public' : key === 'DB_SSL' || key === 'DB_LOGGING' ? false : undefined,
      ),
    } as never as ConfigService;

    const options = createTypeOrmOptions(configService);

    expect(options.entities).toContain(IngestionJob);
  });

  it('registers IngestionJob in data source entities', () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      PORT: '3000',
      NODE_ENV: 'development',
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_USERNAME: 'secop',
      DB_PASSWORD: 'secop',
      DB_NAME: 'secop_agent',
      DB_SCHEMA: 'public',
      DB_SSL: 'false',
      DB_LOGGING: 'false',
      JWT_SECRET: 'secret',
      JWT_EXPIRES_IN: '7d',
      ADMIN_EMAIL: 'admin@secop.com',
      ADMIN_PASSWORD: 'admin-secret',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
      REDIS_PASSWORD: '',
      LLM_BASE_URL: 'http://localhost:11434',
      LLM_API_KEY: 'key',
      HERMES_BASE_URL: 'http://localhost:8080',
    };

    jest.resetModules();
    const { dataSourceOptions } = require('../src/data-source') as typeof import('../src/data-source');

    expect(dataSourceOptions.entities).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: IngestionJob.name })]),
    );

    process.env = originalEnv;
  });
});
