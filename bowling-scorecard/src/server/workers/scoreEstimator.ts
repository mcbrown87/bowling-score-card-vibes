import { createScoreEstimatorWorker } from '@/server/queues/scoreEstimatorQueue';
import { logger } from '@/server/utils/logger';

const scoreWorker = createScoreEstimatorWorker();

const handleShutdown = async () => {
  logger.info('Shutting down workers');
  await scoreWorker.close();
  process.exit(0);
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

scoreWorker.on('ready', () => {
  logger.info('Score estimator worker ready');
});
