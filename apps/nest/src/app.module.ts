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
import { HealthModule } from './modules/health/health.module';
import { LlmModule } from './modules/llm/llm.module';
import { QueuesModule } from './modules/queues/queues.module';
import { RagModule } from './modules/rag/rag.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { validateEnvironment } from './config/env.validation';
import { createTypeOrmOptions } from './config/typeorm.options';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => createTypeOrmOptions(configService),
    }),
    CommonModule,
    AlertsModule,
    AuditModule,
    AuthModule,
    CompaniesModule,
    CompetitorsModule,
    ConvocatoriasModule,
    DocumentsModule,
    HealthModule,
    LlmModule,
    QueuesModule,
    RagModule,
    ScoringModule,
  ],
})
export class AppModule {}
