// The e2e tests get their own database and Redis, next to the development
// ones: same server and credentials, different names. A running `npm run dev`
// (which moves prices every few seconds) then can't disturb them, and the
// tests' users and orders don't pile up in the development data.

/** postgresql://u:p@host:5432/paper_trading -> .../paper_trading_test */
export function testDatabaseUrl(databaseUrl: string): string {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }
  const url = new URL(databaseUrl);
  if (!url.pathname.endsWith('_test')) {
    url.pathname = `${url.pathname}_test`;
  }
  return url.toString();
}

// Redis "database" 1 instead of 0: a separate keyspace on the same server,
// so cached prices and rate-limit counters aren't shared with development
export const TEST_REDIS_URL =
  process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/1';
