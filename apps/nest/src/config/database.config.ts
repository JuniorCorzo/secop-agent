import type { EnvironmentConfig } from './env.validation';

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  schema: string;
  ssl: boolean;
  logging: boolean;
}

/**
 * Shared database configuration factory for runtime NestJS and CLI parity.
 * Returns env-driven settings suitable for TypeORM wiring (ANC-62+).
 * Does NOT include TypeORM-specific options (type, synchronize, entities, migrations).
 */
export const databaseConfig = (
  env: Pick<
    EnvironmentConfig,
    'DB_HOST' | 'DB_PORT' | 'DB_USERNAME' | 'DB_PASSWORD' | 'DB_NAME' | 'DB_SCHEMA' | 'DB_SSL' | 'DB_LOGGING'
  >,
): DatabaseConfig => ({
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USERNAME,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  schema: env.DB_SCHEMA ?? 'public',
  ssl: env.DB_SSL,
  logging: env.DB_LOGGING,
});
