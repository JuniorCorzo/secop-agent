import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ProcurementNoticesModule } from '../procurement-notices/procurement-notices.module';
import { SodaClientService } from './services/soda-client.service';
import { SodaIngestionService } from './services/soda-ingestion.service';

@Module({
  imports: [ScheduleModule.forRoot(), HttpModule, ProcurementNoticesModule],
  providers: [SodaClientService, SodaIngestionService],
  exports: [SodaClientService, SodaIngestionService],
})
export class SodaIngestionModule {}
