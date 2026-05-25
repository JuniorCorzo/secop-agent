import { Injectable, Logger, Module } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewProcurementNoticeEvent } from '../procurement-notices/events/new-procurement-notice.event';
import { QueuesModule } from '../queues/queues.module';
import { ScoringDispatchProducer } from '../queues/producers/scoring-dispatch.producer';
import { CompaniesModule } from '../companies/companies.module';
import { MatchingResult } from './entities/matching-result.entity';
import { ScoreLog } from './entities/score-log.entity';
import { ProcurementNotice } from '../procurement-notices/entities/procurement-notice.entity';
import { Company } from '../companies/entities/company.entity';
import { CompanyContract } from '../companies/entities/company-contract.entity';
import { HardFiltersService } from './services/hard-filters.service';
import { ScoringEngineService } from './services/scoring-engine.service';
import { ScoringQueryService } from './services/scoring-query.service';
import { ScoringWorker } from './workers/scoring.worker';
import { ScoringController } from './controllers/scoring.controller';
import { LlmModule } from '../llm/llm.module';

@Injectable()
/**
 * Event listener that dispatches incoming procurement notices to the scoring queue.
 */
export class ScoringDispatchListener {
  /**
   * Logger instance for the scoring dispatch listener.
   */
  private readonly logger = new Logger(ScoringDispatchListener.name);

  /**
   * Initializes the ScoringDispatchListener.
   *
   * @param scoringDispatchProducer - Producer service to enqueue scoring dispatch jobs.
   */
  constructor(private readonly scoringDispatchProducer: ScoringDispatchProducer) {}

  @OnEvent(NewProcurementNoticeEvent.EVENT_NAME)
  /**
   * Listens to the procurement notice creation event and triggers scoring matching.
   *
   * @param event - The event payload containing notice details.
   * @returns A promise that resolves when the job is successfully queued.
   */
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
    TypeOrmModule.forFeature([MatchingResult, ProcurementNotice, Company, CompanyContract, ScoreLog]),
    QueuesModule,
    CompaniesModule,
    LlmModule,
  ],
  controllers: [ScoringController],
  providers: [
    ScoringDispatchListener,
    HardFiltersService,
    ScoringEngineService,
    ScoringQueryService,
    ScoringWorker,
  ],
  exports: [HardFiltersService, ScoringEngineService, ScoringQueryService, TypeOrmModule],
})
/**
 * Module responsible for coordinating the scoring worker, hard filters, and affinity evaluations.
 */
export class ScoringModule {}

