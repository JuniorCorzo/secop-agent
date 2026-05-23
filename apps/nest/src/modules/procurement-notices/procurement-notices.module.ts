import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngestionJob } from './entities/ingestion-job.entity';
import { ProcurementNotice } from './entities/procurement-notice.entity';
import { SectorKeyword } from './entities/sector-keyword.entity';
import { ProcurementNoticesService } from './services/procurement-notices.service';
import { ProcurementIngestionService } from './services/ingestion.service';
import { SectorClassifierService } from './services/sector-classifier.service';
import { ProcurementNoticesController } from './controllers/procurement-notices.controller';
import { QueuesModule } from '../queues/queues.module';

@Module({
  imports: [TypeOrmModule.forFeature([ProcurementNotice, IngestionJob, SectorKeyword]), QueuesModule],
  controllers: [ProcurementNoticesController],
  providers: [ProcurementNoticesService, ProcurementIngestionService, SectorClassifierService],
  exports: [ProcurementNoticesService],
})
export class ProcurementNoticesModule {}

