import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('.env.example', () => {
  it('documents required ANC-64 vars', () => {
    const content = readFileSync(join(process.cwd(), '.env.example'), 'utf8');

    expect(content).toContain('PORT=3000');
    expect(content).toContain('NODE_ENV=development');
    expect(content).toContain('DB_HOST=localhost');
    expect(content).toContain('DB_PORT=5432');
    expect(content).toContain('DB_USERNAME=secop_dev');
    expect(content).toContain('DB_PASSWORD=secop_dev');
    expect(content).toContain('DB_NAME=secop_agent');
    expect(content).toContain('DB_SCHEMA=public');
    expect(content).toContain('DB_SSL=false');
    expect(content).toContain('DB_LOGGING=false');
    expect(content).toContain('JWT_SECRET=change-me-in-production');
    expect(content).toContain('JWT_EXPIRES_IN=7d');
    expect(content).toContain('REDIS_HOST=localhost');
    expect(content).toContain('REDIS_PORT=6379');
    expect(content).toContain('REDIS_PASSWORD=');
    expect(content).toContain('LLM_BASE_URL=http://localhost:11434');
    expect(content).toContain('LLM_API_KEY=');
    expect(content).toContain('HERMES_BASE_URL=http://localhost:8080');
  });
});
