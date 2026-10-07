import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

// Mock starting prices. Later, MarketDataService will keep currentPrice up to date.
const STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.', currentPrice: '190.00' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', currentPrice: '420.00' },
  { symbol: 'TSLA', name: 'Tesla, Inc.', currentPrice: '250.00' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', currentPrice: '120.00' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', currentPrice: '170.00' },
];

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    for (const stock of STOCKS) {
      // upsert = idempotent: running the seed again never creates duplicates.
      // The price is only set on create, so re-seeding won't overwrite live prices.
      await prisma.stock.upsert({
        where: { symbol: stock.symbol },
        create: stock,
        update: { name: stock.name },
      });
    }
    console.log(`Seeded ${STOCKS.length} stocks`);
  } finally {
    await prisma.$disconnect();
  }
}

await main();
