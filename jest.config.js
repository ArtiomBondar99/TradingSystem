// Jest runs in native ESM mode (see "test" scripts: --experimental-vm-modules),
// because the project is "type": "module" and the Prisma client uses import.meta.
/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  // Our imports end in .js (ESM style); map them back to the .ts source files
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }],
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/generated/**', '!src/main.ts'],
  coverageDirectory: 'coverage',
};
