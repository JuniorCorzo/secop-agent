import type { Queue } from 'bullmq';

export interface QueueHealthResult {
  name: string;
  status: 'up' | 'down' | 'degraded';
  counts?: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  details?: string;
}

export async function checkQueueHealth(queue: Queue): Promise<QueueHealthResult> {
  try {
    const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed');
    return {
      name: `queue:${queue.name}`,
      status: 'up',
      counts: {
        waiting: counts.waiting,
        active: counts.active,
        completed: counts.completed,
        failed: counts.failed,
      },
    };
  } catch (error) {
    return {
      name: `queue:${queue.name}`,
      status: 'down',
      details: error instanceof Error ? error.message : 'unknown error',
    };
  }
}
