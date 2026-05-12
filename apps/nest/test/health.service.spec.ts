import { HealthService } from '../src/modules/health/health.service';

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

describe('HealthService', () => {
  it('reports ok when all checks are up', async () => {
    const service = new HealthService(
      { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as never,
      {
        get: jest.fn((key: string) => {
          if (key === 'HERMES_BASE_URL') return 'http://localhost:8080';
          if (key === 'LLM_BASE_URL') return 'http://localhost:11434';
          if (key === 'LLM_API_KEY') return 'fake-key';
          if (key === 'REDIS_HOST') return 'localhost';
          if (key === 'REDIS_PORT') return 6379;
          return undefined;
        }),
      } as never,
    );

    const result = await service.check();

    expect(result.status).toBe('ok');
    expect(result.checks.database.status).toBe('up');
    expect(JSON.stringify(result)).not.toContain('fake-key');
  });
});
