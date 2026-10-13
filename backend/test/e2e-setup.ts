import { config } from 'dotenv';
import { TEST_REDIS_URL, testDatabaseUrl } from './test-env.js';

// Runs before every e2e test file (jest-e2e.config.js "setupFiles"). Values
// already in process.env win over .env files, so pointing these at the test
// database and Redis here makes the whole app use them.
config({ path: ['.env', '../.env'], quiet: true });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set (see .env.example)');
}
process.env.DATABASE_URL = testDatabaseUrl(process.env.DATABASE_URL);
process.env.REDIS_URL = TEST_REDIS_URL;
