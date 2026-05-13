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

jest.mock('../src/modules/health/indicators/queue.indicator', () => ({
  checkQueueHealth: jest.fn(async () => ({
    name: 'queue:example',
    status: 'up',
    counts: { waiting: 0, active: 0, completed: 0, failed: 0 },
  })),
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
      { name: 'example', getJobCounts: jest.fn() } as never,
    );

    const result = await service.check();

    expect(result.status).toBe('ok');
    expect(result.checks.database.status).toBe('up');
    expect(result.checks.queue.status).toBe('up');
    expect(JSON.stringify(result)).not.toContain('fake-key');
  });

  it('reports degraded when queue is down', async () => {
    const { checkQueueHealth } = jest.requireMock(
      '../src/modules/health/indicators/queue.indicator',
    );
    checkQueueHealth.mockResolvedValueOnce({
      name: 'queue:example',
      status: 'down',
      details: 'connection lost',
    });

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
      { name: 'example', getJobCounts: jest.fn() } as never,
    );

    const result = await service.check();

    expect(result.status).toBe('degraded');
    expect(result.checks.queue.status).toBe('down');
  });
});
