import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { STOCK_UNIVERSE } from '../src/stocks/stock-universe.js';

// Same lookup as AppModule: backend/.env first, then the repo-root .env
config({ path: ['.env', '../.env'] });

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    for (const { symbol, name, basePrice } of STOCK_UNIVERSE) {
      // upsert = idempotent: running the seed again never creates duplicates.
      // The price is only set on create: after that, MarketPriceSyncService
      // keeps currentPrice up to date, and re-seeding must not overwrite it.
      await prisma.stock.upsert({
        where: { symbol },
        create: { symbol, name, currentPrice: basePrice },
        update: { name },
      });
    }
    console.log(`Seeded ${STOCK_UNIVERSE.length} stocks`);
  } finally {
    await prisma.$disconnect();
  }
}

await main();
