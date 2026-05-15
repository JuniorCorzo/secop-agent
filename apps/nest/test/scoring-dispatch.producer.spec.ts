import { BadRequestException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ScoringDispatchProducer } from '../src/modules/queues/producers/scoring-dispatch.producer';

describe('ScoringDispatchProducer', () => {
  let producer: ScoringDispatchProducer;
  let queue: Queue;

  beforeEach(() => {
    queue = {
      add: jest.fn().mockResolvedValue({ id: 'score-job-1' }),
    } as unknown as Queue;

    producer = new ScoringDispatchProducer(queue);
  });

  it('enqueues valid payload to scoring queue', async () => {
    await producer.add({
      procurementNoticeId: '11111111-1111-4111-8111-111111111111',
      secopId: 'SECOP-001',
      sourceEvent: 'NewProcurementNoticeEvent',
    });

    expect(queue.add).toHaveBeenCalledWith(
      'scoring-dispatch',
      expect.objectContaining({ secopId: 'SECOP-001' }),
      expect.any(Object),
    );
  });

  it('rejects invalid payload before enqueue', async () => {
    await expect(
      producer.add({
        procurementNoticeId: 'not-uuid',
        secopId: '',
        sourceEvent: 'OtherEvent',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(queue.add).not.toHaveBeenCalled();
  });
});
