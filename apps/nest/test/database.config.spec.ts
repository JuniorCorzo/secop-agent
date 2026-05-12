import { databaseConfig } from '../src/config/database.config';

describe('databaseConfig', () => {
  it('maps env values to postgres config', () => {
    const config = databaseConfig({
      DB_HOST: 'db',
      DB_PORT: 5432,
      DB_USERNAME: 'user',
      DB_PASSWORD: 'pass',
      DB_NAME: 'secop',
      DB_SCHEMA: 'public',
      DB_SSL: false,
      DB_LOGGING: true,
    });

    expect(config).toEqual({
      host: 'db',
      port: 5432,
      username: 'user',
      password: 'pass',
      database: 'secop',
      schema: 'public',
      ssl: false,
      logging: true,
    });
  });
});
