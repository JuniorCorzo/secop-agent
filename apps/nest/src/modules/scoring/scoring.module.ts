import { Injectable, Logger, Module } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NewProcurementNoticeEvent } from '../procurement-notices/events/new-procurement-notice.event';
import { QueuesModule } from '../queues/queues.module';
import { ScoringDispatchProducer } from '../queues/producers/scoring-dispatch.producer';

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
  imports: [QueuesModule],
  providers: [ScoringDispatchListener],
})
export class ScoringModule {}
