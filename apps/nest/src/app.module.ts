import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from './common/common.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { CompetitorsModule } from './modules/competitors/competitors.module';
import { ConvocatoriasModule } from './modules/convocatorias/convocatorias.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { LlmModule } from './modules/llm/llm.module';
import { RagModule } from './modules/rag/rag.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { databaseConfig } from './config/database.config';
import { SchemaHealth } from './common/entities/schema-health.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: () => {
        const db = databaseConfig();
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
      },
    }),
    CommonModule,
    AlertsModule,
    AuditModule,
    AuthModule,
    CompaniesModule,
    CompetitorsModule,
    ConvocatoriasModule,
    DocumentsModule,
    LlmModule,
    RagModule,
    ScoringModule,
  ],
})
export class AppModule {}
