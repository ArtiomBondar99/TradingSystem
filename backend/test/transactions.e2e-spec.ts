import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/database/prisma.service.js';
import { Prisma } from './../src/generated/prisma/client.js';
import { createTestApp } from './create-test-app.js';

// Requires the seed: npx prisma db seed
// The trade history and the realized P&L of a sale, end to end: a real BUY
// and SELL through POST /orders, read back through GET /transactions.
describe('Transactions (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  // The tests move this stock's price, then put it back
  const SYMBOL = 'KO';
  let originalPrice: Prisma.Decimal;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = createTestApp(moduleFixture);
    await app.init();
    prisma = app.get(PrismaService);

    const stock = await prisma.stock.findUniqueOrThrow({
      where: { symbol: SYMBOL },
    });
    originalPrice = stock.currentPrice;
  });

  afterAll(async () => {
    await setPrice(originalPrice);
    await app.close();
  });

  // The price sync is off in tests: this is the only way the price moves
  const setPrice = (price: Prisma.Decimal) =>
    prisma.stock.update({
      where: { symbol: SYMBOL },
      data: { currentPrice: price },
    });

  const signUp = async (): Promise<string> => {
    const email = `e2e-${randomUUID()}@example.com`;
    const password = 'StrongPass1';

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, firstName: 'Ada', lastName: 'Lovelace', password })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    return login.body.accessToken;
  };

  const trade = (token: string, side: 'BUY' | 'SELL', quantity: number) =>
    request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ symbol: SYMBOL, side, quantity })
      .expect(201);

  const transactions = (token: string, query: Record<string, string> = {}) =>
    request(app.getHttpServer())
      .get('/transactions')
      .query(query)
      .set('Authorization', `Bearer ${token}`);

  it('records the realized P&L of a sale, and filters by type', async () => {
    const token = await signUp();
    const buyPrice = originalPrice;
    const sellPrice = buyPrice.add(5);

    await trade(token, 'BUY', 10);
    await setPrice(sellPrice);
    await trade(token, 'SELL', 4);
    await setPrice(originalPrice);

    const all = await transactions(token).expect(200);
    expect(all.body.items.map((t: { type: string }) => t.type)).toEqual([
      'SELL', // newest first
      'BUY',
    ]);

    const sales = await transactions(token, { type: 'SELL' }).expect(200);
    expect(sales.body.items).toHaveLength(1);
    // (sell - buy) * 4 shares; no fees in tests
    expect(sales.body.items[0]).toMatchObject({
      symbol: SYMBOL,
      quantity: 4,
      realizedPnL: '20.00',
    });

    // The same total on the portfolio
    const portfolio = await request(app.getHttpServer())
      .get('/portfolio')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(portfolio.body.realizedPnL).toBe('20.00');
  });

  it('filters by symbol, case-insensitively', async () => {
    const token = await signUp();
    await trade(token, 'BUY', 1);

    const ko = await transactions(token, { symbol: 'ko' }).expect(200);
    const aapl = await transactions(token, { symbol: 'AAPL' }).expect(200);

    expect(ko.body.items).toHaveLength(1);
    expect(aapl.body.items).toHaveLength(0);
  });

  it('pages through a filtered history with the cursor', async () => {
    const token = await signUp();
    for (let i = 0; i < 3; i++) {
      await trade(token, 'BUY', 1);
    }

    const first = await transactions(token, {
      type: 'BUY',
      limit: '2',
    }).expect(200);
    const second = await transactions(token, {
      type: 'BUY',
      limit: '2',
      cursor: first.body.nextCursor,
    }).expect(200);

    expect(first.body.items).toHaveLength(2);
    expect(second.body.items).toHaveLength(1);
    expect(second.body.nextCursor).toBeNull();
  });

  it('returns 400 for an unknown type', async () => {
    const token = await signUp();

    const response = await transactions(token, { type: 'SHORT' }).expect(400);

    expect(JSON.stringify(response.body)).toContain('type must be one of');
  });
});
