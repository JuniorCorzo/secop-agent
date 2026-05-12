import { DataSource, DataSourceOptions } from 'typeorm';
import { databaseConfig } from './config/database.config';
import { validateEnvironment } from './config/env.validation';
import { SchemaHealth } from './common/entities/schema-health.entity';
import { User } from './modules/auth/entities/user.entity';

const env = validateEnvironment(process.env as Record<string, unknown>);
const db = databaseConfig(env);

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: db.host,
  port: db.port,
  username: db.username,
  password: db.password,
  database: db.database,
  schema: db.schema,
  logging: db.logging,
  synchronize: false,
  entities: [SchemaHealth, User],
  migrations: ['src/migrations/*.ts'],
  migrationsTableName: 'typeorm_migrations',
  ...(db.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
};

export default new DataSource(dataSourceOptions);
