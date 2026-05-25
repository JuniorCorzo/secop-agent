import { BadRequestException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { CompanyScoringBatchProducer } from '../src/modules/queues/producers/company-scoring-batch.producer';

describe('CompanyScoringBatchProducer', () => {
  let producer: CompanyScoringBatchProducer;
  let queue: Queue;

  beforeEach(() => {
    queue = {
      add: jest.fn().mockResolvedValue({ id: 'batch-job-1' }),
    } as unknown as Queue;

    producer = new CompanyScoringBatchProducer(queue);
  });

  it('enqueues valid batch payload to scoring queue', async () => {
    const payload = {
      companyId: '11111111-1111-4111-8111-111111111111',
      noticeIds: [
        '22222222-2222-4222-8222-222222222222',
        '33333333-3333-4333-8333-333333333333',
      ],
    };

    await producer.add(payload);

    expect(queue.add).toHaveBeenCalledWith(
      'company-batch-scoring',
      expect.objectContaining({
        companyId: payload.companyId,
        noticeIds: payload.noticeIds,
      }),
      expect.any(Object),
    );
  });

  it('rejects invalid payload before enqueue (missing noticeIds)', async () => {
    await expect(
      producer.add({
        companyId: '11111111-1111-4111-8111-111111111111',
        noticeIds: [],
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rejects invalid payload before enqueue (invalid UUID in noticeIds)', async () => {
    await expect(
      producer.add({
        companyId: '11111111-1111-4111-8111-111111111111',
        noticeIds: ['invalid-uuid'],
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rejects invalid payload before enqueue (too many noticeIds, limit 100)', async () => {
    const manyIds = Array(101).fill('22222222-2222-4222-8222-222222222222');
    await expect(
      producer.add({
        companyId: '11111111-1111-4111-8111-111111111111',
        noticeIds: manyIds,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(queue.add).not.toHaveBeenCalled();
  });
});
