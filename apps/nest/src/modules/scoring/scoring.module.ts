import { Injectable, Logger, Module } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewProcurementNoticeEvent } from '../procurement-notices/events/new-procurement-notice.event';
import { QueuesModule } from '../queues/queues.module';
import { ScoringDispatchProducer } from '../queues/producers/scoring-dispatch.producer';
import { CompaniesModule } from '../companies/companies.module';
import { MatchingResult } from './entities/matching-result.entity';
import { ProcurementNotice } from '../procurement-notices/entities/procurement-notice.entity';
import { Company } from '../companies/entities/company.entity';
import { CompanyContract } from '../companies/entities/company-contract.entity';
import { HardFiltersService } from './services/hard-filters.service';
import { ScoringEngineService } from './services/scoring-engine.service';
import { ScoringWorker } from './workers/scoring.worker';

@Injectable()
export class ScoringDispatchListener {
  private readonly logger = new Logger(ScoringDispatchListener.name);

  constructor(private readonly scoringDispatchProducer: ScoringDispatchProducer) {}

  @OnEvent(NewProcurementNoticeEvent.EVENT_NAME)
  async handle(event: NewProcurementNoticeEvent): Promise<void> {
    if (!event.procurementNoticeId || !event.secopId) {
      this.logger.warn('Skipping scoring dispatch for invalid procurement notice event');
      return;
    }

    await this.scoringDispatchProducer.add({
      procurementNoticeId: event.procurementNoticeId,
      secopId: event.secopId,
      sourceEvent: 'NewProcurementNoticeEvent',
    });
  }
}

@Module({
  imports: [
    TypeOrmModule.forFeature([MatchingResult, ProcurementNotice, Company, CompanyContract]),
    QueuesModule,
    CompaniesModule,
  ],
  providers: [
    ScoringDispatchListener,
    HardFiltersService,
    ScoringEngineService,
    ScoringWorker,
  ],
  exports: [HardFiltersService, ScoringEngineService],
})
export class ScoringModule {}

