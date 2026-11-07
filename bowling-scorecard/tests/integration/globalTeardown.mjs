export default async function globalTeardown() {
  const containers = globalThis.__integrationContainers;

  if (containers) {
    await Promise.allSettled([containers.redis.stop(), containers.postgres.stop()]);
  }
}
