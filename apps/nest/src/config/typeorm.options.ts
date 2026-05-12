import { ConfigService } from '@nestjs/config';
import { SchemaHealth } from '../common/entities/schema-health.entity';
import { databaseConfig } from './database.config';

export const createTypeOrmOptions = (configService: ConfigService) => {
  const db = databaseConfig({
    DB_HOST: configService.getOrThrow<string>('DB_HOST'),
    DB_PORT: configService.getOrThrow<number>('DB_PORT'),
    DB_USERNAME: configService.getOrThrow<string>('DB_USERNAME'),
    DB_PASSWORD: configService.getOrThrow<string>('DB_PASSWORD'),
    DB_NAME: configService.getOrThrow<string>('DB_NAME'),
    DB_SCHEMA: configService.get<string>('DB_SCHEMA') ?? 'public',
    DB_SSL: configService.get<boolean>('DB_SSL') ?? false,
    DB_LOGGING: configService.get<boolean>('DB_LOGGING') ?? false,
  });

  return {
    type: 'postgres' as const,
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
  };
};
