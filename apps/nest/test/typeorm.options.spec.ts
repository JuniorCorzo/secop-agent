import { ConfigService } from '@nestjs/config';
import { createTypeOrmOptions } from '../src/config/typeorm.options';

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
});
