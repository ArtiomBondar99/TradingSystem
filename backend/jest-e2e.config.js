import baseConfig from './jest.config.js';

// E2E tests boot the whole app against a real database: a separate test
// database (npm run test:e2e:prepare), set up by test/e2e-setup.ts
/** @type {import('jest').Config} */
export default {
  ...baseConfig,
  testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
  setupFiles: ['<rootDir>/test/e2e-setup.ts'],
  collectCoverageFrom: undefined,
  // Booting AppModule on a cold ts-jest cache (first run, CI) takes > 5s
  testTimeout: 30_000,
};
