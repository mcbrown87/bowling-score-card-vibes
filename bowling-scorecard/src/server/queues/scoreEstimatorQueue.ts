import { Queue, Worker } from 'bullmq';

import { logger } from '@/server/utils/logger';
import {
  type ScoreEstimatorJobPayload,
  processScoreEstimatorJob
} from '@/server/services/scoreEstimator';

const queueName = process.env.SCORE_ESTIMATE_QUEUE ?? 'score-estimates';
const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

type QueueGlobals = typeof globalThis & {
  scoreEstimatorQueue?: Queue<ScoreEstimatorJobPayload>;
};

const globalQueue = globalThis as QueueGlobals;

const getConnectionOptions = () => ({
  connection: {
    url: redisUrl
  }
});

export const getScoreEstimatorQueue = () => {
  if (!globalQueue.scoreEstimatorQueue) {
    globalQueue.scoreEstimatorQueue = new Queue<ScoreEstimatorJobPayload>(
      queueName,
      getConnectionOptions()
    );
  }

  return globalQueue.scoreEstimatorQueue;
};

export const enqueueScoreEstimatorJob = async (payload: ScoreEstimatorJobPayload) => {
  const queue = getScoreEstimatorQueue();
  return queue.add('score-estimate', payload, {
    removeOnComplete: 250,
    removeOnFail: 1000
  });
};

export const createScoreEstimatorWorker = () => {
  const worker = new Worker<ScoreEstimatorJobPayload>(
    queueName,
    async (job) => {
      logger.info('Score estimator job started', {
        jobId: job.id,
        storedImageId: job.data.storedImageId
      });
      await processScoreEstimatorJob(job.data);
    },
    getConnectionOptions()
  );

  worker.on('active', (job) => {
    logger.info('Score estimator worker processing job', {
      jobId: job.id,
      storedImageId: job.data.storedImageId
    });
  });

  worker.on('completed', (job) => {
    logger.info('Score estimator job completed', {
      jobId: job.id
    });
  });

  worker.on('failed', (job, error) => {
    logger.error('Score estimator job failed', error, {
      jobId: job?.id
    });
  });

  return worker;
};
