import { createScoreEstimatorWorker } from '@/server/queues/scoreEstimatorQueue';
import { logger } from '@/server/utils/logger';

const worker = createScoreEstimatorWorker();

const handleShutdown = async () => {
  logger.info('Shutting down score estimator worker');
  await worker.close();
  process.exit(0);
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

worker.on('ready', () => {
  logger.info('Score estimator worker ready');
});
