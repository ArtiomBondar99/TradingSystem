import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import type { PrismaService } from './../src/database/prisma.service.js';
import type { LimitOrderMatcher } from './../src/orders/limit-order-matcher.service.js';

// Fees and slippage are off in tests (the other order tests expect plain
// fills), so this file turns them on. Like rate-limit.e2e-spec.ts, the env
// must be set BEFORE the app's config loads: hence the dynamic imports.
// Market hours stay off here: a test can't pick the time of day. They are
// covered by unit tests with a fake clock (orders.service.spec.ts).
// Requires the seed, and no `npm run dev` running (it moves AAPL's price).
describe('Trading rules: fees, slippage, stop orders (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let matcher: LimitOrderMatcher;
  let originalPrice: string;

  beforeAll(async () => {
    process.env.TRADING_FEES_ENABLED = 'true';
    process.env.TRADING_SLIPPAGE_BPS = '5';
    process.env.TRADING_MARKET_HOURS = 'false';

    const { AppModule } = await import('./../src/app.module.js');
    const { PrismaService } =
      await import('./../src/database/prisma.service.js');
    const { LimitOrderMatcher } =
      await import('./../src/orders/limit-order-matcher.service.js');

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.listen(0);
    prisma = app.get(PrismaService);
    matcher = app.get(LimitOrderMatcher);

    const stock = await prisma.stock.findUniqueOrThrow({
      where: { symbol: 'AAPL' },
    });
    originalPrice = stock.currentPrice.toFixed(2);
    await setPrice('100.00');
  });

  afterAll(async () => {
    await setPrice(originalPrice);
    delete process.env.TRADING_FEES_ENABLED;
    delete process.env.TRADING_SLIPPAGE_BPS;
    delete process.env.TRADING_MARKET_HOURS;
    await app.close();
  });

  const setPrice = (price: string) =>
    prisma.stock.update({
      where: { symbol: 'AAPL' },
      data: { currentPrice: price },
    });

  const signUp = async (): Promise<string> => {
    const email = `e2e-rules-${randomUUID()}@example.com`;
    const password = 'StrongPass1';
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, firstName: 'Ru', lastName: 'Les', password })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return login.body.accessToken;
  };

  const order = (token: string, body: object) =>
    request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ symbol: 'AAPL', ...body })
      .expect(201);

  const cash = async (token: string) =>
    (
      await request(app.getHttpServer())
        .get('/wallet')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
    ).body.cashBalance as string;

  it('a market BUY pays slippage and commission; the trade records both', async () => {
    const token = await signUp();

    const placed = await order(token, { side: 'BUY', quantity: 10 });

    // 100 * 1.0005 = 100.05; 10 shares = 1000.50; commission min 1.00
    expect(placed.body).toMatchObject({
      status: 'FILLED',
      price: '100.05',
      fee: '1.00',
    });
    expect(await cash(token)).toBe('98998.50');

    const transactions = await request(app.getHttpServer())
      .get('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(transactions.body.items[0]).toMatchObject({
      price: '100.05',
      amount: '1000.50',
      fee: '1.00',
    });
  });

  it('a market SELL gets less (slippage) and pays commission', async () => {
    const token = await signUp();
    await order(token, { side: 'BUY', quantity: 10 }); // -1001.50

    const sold = await order(token, { side: 'SELL', quantity: 10 });

    // 100 * 0.9995 = 99.95; 999.50 - 1.00 = +998.50
    expect(sold.body).toMatchObject({ price: '99.95', fee: '1.00' });
    expect(await cash(token)).toBe('99997.00');
  });

  it('a SELL stop-loss waits, then sells at market when the price falls to it', async () => {
    const token = await signUp();
    await order(token, { side: 'BUY', quantity: 10 });

    const stop = await order(token, {
      side: 'SELL',
      type: 'STOP',
      quantity: 10,
      stopPrice: 95,
    });
    expect(stop.body).toMatchObject({ status: 'PENDING', stopPrice: '95.00' });

    await setPrice('96.00');
    await matcher.matchOnce();
    let saved = await prisma.order.findUniqueOrThrow({
      where: { id: stop.body.id },
    });
    expect(saved.status).toBe('PENDING');

    // Gaps through the stop: sells at the market, 94 * 0.9995 = 93.953 -> 93.95
    await setPrice('94.00');
    await matcher.matchOnce();
    saved = await prisma.order.findUniqueOrThrow({
      where: { id: stop.body.id },
    });
    expect(saved.status).toBe('FILLED');
    expect(saved.price?.toFixed(2)).toBe('93.95');

    await setPrice('100.00');
  });

  it('a BUY stop (breakout) fills once the price rises to it', async () => {
    const token = await signUp();
    const stop = await order(token, {
      side: 'BUY',
      type: 'STOP',
      quantity: 5,
      stopPrice: 105,
    });
    expect(stop.body.status).toBe('PENDING');

    await setPrice('106.00');
    await matcher.matchOnce();

    const saved = await prisma.order.findUniqueOrThrow({
      where: { id: stop.body.id },
    });
    // 106 * 1.0005 = 106.053 -> 106.06
    expect(saved).toMatchObject({ status: 'FILLED' });
    expect(saved.price?.toFixed(2)).toBe('106.06');

    await setPrice('100.00');
  });

  it('a LIMIT fill is never worse than its limit, even with slippage', async () => {
    const token = await signUp();

    // Market 100, slipped 100.05, but at most 100.02
    const placed = await order(token, {
      side: 'BUY',
      type: 'LIMIT',
      quantity: 1,
      limitPrice: 100.02,
    });

    expect(placed.body).toMatchObject({ status: 'FILLED', price: '100.02' });
  });

  it('returns 400 for a STOP without stopPrice', async () => {
    const token = await signUp();
    await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ symbol: 'AAPL', side: 'SELL', type: 'STOP', quantity: 1 })
      .expect(400);
  });
});
