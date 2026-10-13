import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Same lookup as AppModule: backend/.env first, then the repo-root .env
config({ path: ['.env', '../.env'] });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
