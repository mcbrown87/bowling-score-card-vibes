import { execFileSync } from 'node:child_process';

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';

export default async function globalSetup() {
  const [postgres, redis] = await Promise.all([
    new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('bowling_scorecard_test')
      .withUsername('postgres')
      .withPassword('postgres')
      .start(),
    new RedisContainer('redis:7-alpine').start()
  ]);

  process.env.DATABASE_URL = postgres.getConnectionUri();
  process.env.REDIS_URL = redis.getConnectionUrl();
  process.env.SCORE_ESTIMATE_QUEUE = `score-estimates-test-${process.pid}`;
  globalThis.__integrationContainers = { postgres, redis };

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit'
  });
}
