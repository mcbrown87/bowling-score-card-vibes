import { QueueEvents } from 'bullmq';

import {
  createScoreEstimatorQueue,
  createScoreEstimatorWorker
} from '@/server/queues/scoreEstimatorQueue';

jest.mock('@/server/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn()
  }
}));

describe('score estimator queue with Redis', () => {
  it('enqueues a payload and processes it with a real BullMQ worker', async () => {
    const queueName = `score-estimator-success-${Date.now()}`;
    const redisUrl = process.env.REDIS_URL as string;
    const processor = jest.fn().mockResolvedValue(undefined);
    const queue = createScoreEstimatorQueue({ queueName, redisUrl });
    const worker = createScoreEstimatorWorker({ queueName, redisUrl, processor });
    const events = new QueueEvents(queueName, { connection: { url: redisUrl } });

    try {
      await Promise.all([worker.waitUntilReady(), events.waitUntilReady()]);
      const payload = { storedImageId: 'image-1', llmRequestId: 'request-1' };
      const job = await queue.add('score-estimate', payload);

      await job.waitUntilFinished(events, 10_000);

      expect(processor).toHaveBeenCalledWith(payload);
      await expect(job.getState()).resolves.toBe('completed');
    } finally {
      await Promise.allSettled([worker.close(), events.close(), queue.close()]);
    }
  });

  it('records a failed job when the processor rejects', async () => {
    const queueName = `score-estimator-failure-${Date.now()}`;
    const redisUrl = process.env.REDIS_URL as string;
    const queue = createScoreEstimatorQueue({ queueName, redisUrl });
    const worker = createScoreEstimatorWorker({
      queueName,
      redisUrl,
      processor: async () => {
        throw new Error('provider unavailable');
      }
    });
    const events = new QueueEvents(queueName, { connection: { url: redisUrl } });
    try {
      await Promise.all([worker.waitUntilReady(), events.waitUntilReady()]);
      const job = await queue.add('score-estimate', {
        storedImageId: 'image-2',
        llmRequestId: 'request-2'
      });

      await expect(job.waitUntilFinished(events, 10_000)).rejects.toThrow('provider unavailable');
      await expect(job.getState()).resolves.toBe('failed');
    } finally {
      await Promise.allSettled([worker.close(), events.close(), queue.close()]);
    }
  });
});
