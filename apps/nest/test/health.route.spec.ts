import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'node:net';
import { HealthController } from '../src/modules/health/health.controller';
import { HealthService } from '../src/modules/health/health.service';
import { DataSource } from 'typeorm';

jest.mock('../src/modules/health/indicators/postgres.indicator', () => ({
  checkPostgresHealth: jest.fn(async () => ({ name: 'database', status: 'up' })),
}));

jest.mock('../src/modules/health/indicators/redis.indicator', () => ({
  checkRedisHealth: jest.fn(async () => ({ name: 'redis', status: 'up' })),
}));

jest.mock('../src/modules/health/indicators/http.indicator', () => ({
  checkHttpHealth: jest.fn(async (name: string) => ({ name, status: 'up' })),
  checkLlmHealth: jest.fn(async () => ({ name: 'llm', status: 'up' })),
}));

describe('Health route', () => {
  it('responds on /api/health', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: DataSource, useValue: { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'HERMES_BASE_URL') return 'http://localhost:8080';
              if (key === 'LLM_BASE_URL') return 'http://localhost:11434';
              if (key === 'LLM_API_KEY') return 'fake-key';
              if (key === 'REDIS_HOST') return 'localhost';
              if (key === 'REDIS_PORT') return 6379;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0);

    try {
      const address = app.getHttpServer().address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe('ok');
      expect(body.checks.database.status).toBe('up');
    } finally {
      await app.close();
    }
  });
});
