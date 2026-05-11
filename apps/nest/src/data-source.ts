import { DataSource, DataSourceOptions } from 'typeorm';
import { databaseConfig } from './config/database.config';
import { SchemaHealth } from './common/entities/schema-health.entity';

const db = databaseConfig();

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: db.host,
  port: db.port,
  username: db.username,
  password: db.password,
  database: db.database,
  schema: db.schema,
  ssl: db.ssl,
  logging: db.logging,
  synchronize: false,
  entities: [SchemaHealth],
  migrations: ['src/migrations/*.ts'],
  migrationsTableName: 'typeorm_migrations',
};

export default new DataSource(dataSourceOptions);
