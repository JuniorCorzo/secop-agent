import { BadRequestException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ExampleQueueProducer } from '../src/modules/queues/producers/example-queue.producer';

describe('ExampleQueueProducer', () => {
  it('adds a job with default retry options', async () => {
    const addMock = jest.fn().mockResolvedValue({ id: 'job-1' });
    const queue = { add: addMock } as unknown as Queue;

    const producer = new ExampleQueueProducer(queue);
    const result = await producer.add({
      message: 'test',
      timestamp: Date.now(),
    });

    expect(addMock).toHaveBeenCalledWith(
      'example-job',
      expect.objectContaining({ message: 'test' }),
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      }),
    );
    expect(result).toEqual({ id: 'job-1' });
  });

  it('allows overriding default options', async () => {
    const addMock = jest.fn().mockResolvedValue({ id: 'job-2' });
    const queue = { add: addMock } as unknown as Queue;

    const producer = new ExampleQueueProducer(queue);
    await producer.add(
      { message: 'test', timestamp: Date.now() },
      { attempts: 5 },
    );

    expect(addMock).toHaveBeenCalledWith(
      'example-job',
      expect.anything(),
      expect.objectContaining({
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
      }),
    );
  });

  it('rejects invalid payload missing required fields', async () => {
    const addMock = jest.fn();
    const queue = { add: addMock } as unknown as Queue;

    const producer = new ExampleQueueProducer(queue);
    await expect(
      producer.add({ message: 'test' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(addMock).not.toHaveBeenCalled();
  });

  it('rejects invalid payload with wrong types', async () => {
    const addMock = jest.fn();
    const queue = { add: addMock } as unknown as Queue;

    const producer = new ExampleQueueProducer(queue);
    await expect(
      producer.add({ message: 123, timestamp: 'now' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(addMock).not.toHaveBeenCalled();
  });
});
