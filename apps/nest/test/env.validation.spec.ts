import { validateEnvironment } from '../src/config/env.validation';

describe('validateEnvironment', () => {
  it('accepts a valid environment', () => {
    const env = validateEnvironment({
      PORT: 3000,
      NODE_ENV: 'development',
      DB_HOST: 'localhost',
      DB_PORT: 5432,
      DB_USERNAME: 'secop',
      DB_PASSWORD: 'secop',
      DB_NAME: 'secop_agent',
      DB_SCHEMA: 'public',
      DB_SSL: false,
      DB_LOGGING: false,
      JWT_SECRET: 'secret',
      JWT_EXPIRES_IN: '7d',
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      REDIS_PASSWORD: '',
      LLM_BASE_URL: 'http://localhost:11434',
      LLM_API_KEY: 'key',
      HERMES_BASE_URL: 'http://localhost:8080',
    });

    expect(env.PORT).toBe(3000);
    expect(env.DB_HOST).toBe('localhost');
  });

  it('rejects invalid environment', () => {
    expect(() =>
      validateEnvironment({
        PORT: 'nope',
        NODE_ENV: 'dev',
      }),
    ).toThrow(/Environment validation failed/);
  });
});
