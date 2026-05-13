import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcurementNotice } from './entities/procurement-notice.entity';
import { ProcurementNoticesService } from './services/procurement-notices.service';
import { ProcurementIngestionService } from './services/ingestion.service';
import { ProcurementNoticesController } from './controllers/procurement-notices.controller';
import { QueuesModule } from '../queues/queues.module';

@Module({
  imports: [TypeOrmModule.forFeature([ProcurementNotice]), QueuesModule],
  controllers: [ProcurementNoticesController],
  providers: [ProcurementNoticesService, ProcurementIngestionService],
  exports: [ProcurementNoticesService],
})
export class ProcurementNoticesModule {}
