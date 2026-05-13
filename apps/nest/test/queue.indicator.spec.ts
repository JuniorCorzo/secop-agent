import { Queue } from 'bullmq';
import { checkQueueHealth } from '../src/modules/health/indicators/queue.indicator';

describe('checkQueueHealth', () => {
  it('reports up with counts when queue is healthy', async () => {
    const queue = {
      name: 'example',
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 2,
        active: 1,
        completed: 10,
        failed: 0,
      }),
    } as unknown as Queue;

    const result = await checkQueueHealth(queue);

    expect(result.status).toBe('up');
    expect(result.counts).toEqual({
      waiting: 2,
      active: 1,
      completed: 10,
      failed: 0,
    });
  });

  it('reports down when queue throws', async () => {
    const queue = {
      name: 'example',
      getJobCounts: jest.fn().mockRejectedValue(new Error('connection lost')),
    } as unknown as Queue;

    const result = await checkQueueHealth(queue);

    expect(result.status).toBe('down');
    expect(result.details).toBe('connection lost');
  });
});
