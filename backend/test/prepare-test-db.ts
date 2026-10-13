import { execSync } from 'node:child_process';
import { config } from 'dotenv';
import pg from 'pg';
import { testDatabaseUrl } from './test-env.js';

// npm run test:e2e:prepare: creates the e2e test database if it doesn't exist
// yet, applies every migration and seeds the stocks. Safe to re-run.
config({ path: ['.env', '../.env'], quiet: true });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set (see .env.example)');
}

const url = testDatabaseUrl(process.env.DATABASE_URL);
const name = new URL(url).pathname.slice(1);

// CREATE DATABASE runs while connected to another database: "postgres"
const admin = new URL(url);
admin.pathname = '/postgres';
admin.search = '';

const client = new pg.Client({ connectionString: admin.toString() });
await client.connect();
const exists = await client.query(
  'SELECT 1 FROM pg_database WHERE datname = $1',
  [name],
);
if (exists.rowCount === 0) {
  // An identifier can't be a $1 parameter; the name comes from our own .env
  await client.query(`CREATE DATABASE "${name.replaceAll('"', '')}"`);
  console.log(`Created database ${name}`);
}
await client.end();

const env = { ...process.env, DATABASE_URL: url };
execSync('npx prisma migrate deploy', { stdio: 'inherit', env });
execSync('npx prisma db seed', { stdio: 'inherit', env });
