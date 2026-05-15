import { ScoringDispatchListener } from '../src/modules/scoring/scoring.module';
import { NewProcurementNoticeEvent } from '../src/modules/procurement-notices/events/new-procurement-notice.event';

describe('ScoringDispatchListener', () => {
  let listener: ScoringDispatchListener;
  let producer: jest.Mocked<any>;

  beforeEach(() => {
    producer = {
      add: jest.fn().mockResolvedValue({ id: 'score-job-1' }),
    };

    listener = new ScoringDispatchListener(producer);
  });

  it('translates one persisted notice event into one scoring dispatch job', async () => {
    const event = new NewProcurementNoticeEvent({
      ingestionJobId: 'ingestion-job-1',
      procurementNoticeId: '11111111-1111-4111-8111-111111111111',
      secopId: 'SECOP-001',
      action: 'created',
    });

    await listener.handle(event);

    expect(producer.add).toHaveBeenCalledWith({
      procurementNoticeId: '11111111-1111-4111-8111-111111111111',
      secopId: 'SECOP-001',
      sourceEvent: 'NewProcurementNoticeEvent',
    });
  });

  it('skips dispatch when event payload is invalid', async () => {
    const event = new NewProcurementNoticeEvent({
      ingestionJobId: 'ingestion-job-1',
      procurementNoticeId: '',
      secopId: '',
      action: 'updated',
    } as any);

    await listener.handle(event);

    expect(producer.add).not.toHaveBeenCalled();
  });
});
