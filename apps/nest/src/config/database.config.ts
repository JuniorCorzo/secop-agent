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
export const databaseConfig = (): DatabaseConfig => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? '',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? '',
  schema: process.env.DB_SCHEMA ?? 'public',
  ssl: process.env.DB_SSL === 'true',
  logging: process.env.DB_LOGGING === 'true',
});
