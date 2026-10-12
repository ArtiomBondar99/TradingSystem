import baseConfig from './jest.config.js';

// E2E tests boot the whole app against the real database (docker compose up -d postgres)
/** @type {import('jest').Config} */
export default {
  ...baseConfig,
  testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
  collectCoverageFrom: undefined,
  // Booting AppModule on a cold ts-jest cache (first run, CI) takes > 5s
  testTimeout: 30_000,
};
