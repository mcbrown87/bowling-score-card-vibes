import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const customJestConfig = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/integration/**/*.integration.test.ts'],
  moduleDirectories: ['node_modules', '<rootDir>/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  globalSetup: '<rootDir>/tests/integration/globalSetup.mjs',
  globalTeardown: '<rootDir>/tests/integration/globalTeardown.mjs',
  maxWorkers: 1
};

export default createJestConfig(customJestConfig);
