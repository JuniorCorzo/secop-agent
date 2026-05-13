import { Queue } from 'bullmq';
import { BaseQueueProducer } from '../src/modules/queues/producers/base-queue.producer';

class TestProducer extends BaseQueueProducer<{ value: number }> {
  protected readonly queue: Queue;
  protected readonly jobName = 'test-job';

  constructor(queue: Queue) {
    super();
    this.queue = queue;
  }
}

describe('BaseQueueProducer', () => {
  it('applies default retry options when adding a job', async () => {
    const addMock = jest.fn().mockResolvedValue({ id: 'job-1' });
    const queue = { add: addMock } as unknown as Queue;

    const producer = new TestProducer(queue);
    await producer.add({ value: 42 });

    expect(addMock).toHaveBeenCalledWith(
      'test-job',
      { value: 42 },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
  });

  it('merges custom opts over defaults', async () => {
    const addMock = jest.fn().mockResolvedValue({ id: 'job-2' });
    const queue = { add: addMock } as unknown as Queue;

    const producer = new TestProducer(queue);
    await producer.add({ value: 42 }, { attempts: 1, priority: 10 });

    expect(addMock).toHaveBeenCalledWith(
      'test-job',
      { value: 42 },
      {
        attempts: 1,
        backoff: { type: 'exponential', delay: 2000 },
        priority: 10,
      },
    );
  });
});
