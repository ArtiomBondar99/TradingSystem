import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/database/prisma.service.js';
import { Prisma } from './../src/generated/prisma/client.js';
import { LimitOrderMatcher } from './../src/orders/limit-order-matcher.service.js';
import { createTestApp } from './create-test-app.js';

const D = (value: string | number) => new Prisma.Decimal(value);

// Against the real database: reservations and the matcher only mean
// something with real transactions and real row locks.
// Requires the seed (npx prisma db seed), and no `npm run dev` running: its
// price sync would move AAPL while these tests set it by hand.
describe('Limit orders (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let matcher: LimitOrderMatcher;
  let originalPrice: Prisma.Decimal;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = createTestApp(moduleFixture);
    await app.listen(0);
    prisma = app.get(PrismaService);
    matcher = app.get(LimitOrderMatcher);

    const stock = await prisma.stock.findUniqueOrThrow({
      where: { symbol: 'AAPL' },
    });
    originalPrice = stock.currentPrice;
    await setPrice('100.00');
  });

  afterAll(async () => {
    await setPrice(originalPrice);
    await app.close();
  });

  // The test plays the market: it moves the price, then runs one matching round
  const setPrice = (price: string | Prisma.Decimal) =>
    prisma.stock.update({
      where: { symbol: 'AAPL' },
      data: { currentPrice: price },
    });

  const signUp = async (): Promise<string> => {
    const email = `e2e-limit-${randomUUID()}@example.com`;
    const password = 'StrongPass1';
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, firstName: 'Lim', lastName: 'It', password })
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

  const cash = async (token: string) => {
    const wallet = await request(app.getHttpServer())
      .get('/wallet')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return D(wallet.body.cashBalance);
  };

  const cancel = (token: string, id: string) =>
    request(app.getHttpServer())
      .post(`/orders/${id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

  it('a BUY limit below the market waits, then fills at the market price once reached', async () => {
    const token = await signUp();

    const placed = await order(token, {
      side: 'BUY',
      type: 'LIMIT',
      quantity: 10,
      limitPrice: 95,
    });
    expect(placed.body).toMatchObject({
      status: 'PENDING',
      limitPrice: '95.00',
      price: null,
    });
    expect((await cash(token)).toFixed(2)).toBe('100000.00');

    // Not reached yet: nothing happens
    await setPrice('95.01');
    await matcher.matchOnce();
    expect((await cash(token)).toFixed(2)).toBe('100000.00');

    // The price drops through the limit: it fills at 94.50, better than 95
    await setPrice('94.50');
    await matcher.matchOnce();

    const orders = await request(app.getHttpServer())
      .get('/orders')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(orders.body.items[0]).toMatchObject({
      id: placed.body.id,
      status: 'FILLED',
      price: '94.50',
    });
    expect((await cash(token)).toFixed(2)).toBe('99055.00');

    await setPrice('100.00');
  });

  it('a SELL limit fills once the price rises to it', async () => {
    const token = await signUp();
    await order(token, { side: 'BUY', quantity: 5 }); // at 100
    const placed = await order(token, {
      side: 'SELL',
      type: 'LIMIT',
      quantity: 5,
      limitPrice: 110,
    });
    expect(placed.body.status).toBe('PENDING');

    await setPrice('110.00');
    await matcher.matchOnce();

    // 100,000 - 500 + 550
    expect((await cash(token)).toFixed(2)).toBe('100050.00');
    await setPrice('100.00');
  });

  it('cash reserved by an open BUY limit cannot be spent by another order', async () => {
    const token = await signUp();
    // Reserves 900 * 100 = 90,000 of the 100,000
    await order(token, {
      side: 'BUY',
      type: 'LIMIT',
      quantity: 900,
      limitPrice: 100 - 1,
    });

    const market = await order(token, { side: 'BUY', quantity: 150 }); // 15,000 > 10,000 left
    expect(market.body).toMatchObject({
      status: 'REJECTED',
      rejectReason: 'INSUFFICIENT_FUNDS',
    });

    const fits = await order(token, { side: 'BUY', quantity: 100 }); // 10,000: exactly what's left
    expect(fits.body.status).toBe('FILLED');
  });

  it('parallel BUY limits never reserve more cash than the wallet holds', async () => {
    const token = await signUp();

    // Each one reserves 300 * 99 = 29,700: only 3 fit in 100,000
    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        order(token, {
          side: 'BUY',
          type: 'LIMIT',
          quantity: 300,
          limitPrice: 99,
        }),
      ),
    );

    const statuses = responses.map((r) => r.body.status);
    expect(statuses.filter((s) => s === 'PENDING')).toHaveLength(3);
    expect(statuses.filter((s) => s === 'REJECTED')).toHaveLength(7);
  });

  it('cancels an open order once; a second cancel or another user gets 409/404', async () => {
    const token = await signUp();
    const other = await signUp();
    const placed = await order(token, {
      side: 'BUY',
      type: 'LIMIT',
      quantity: 1,
      limitPrice: 50,
    });

    await cancel(other, placed.body.id).expect(404);

    const cancelled = await cancel(token, placed.body.id).expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');

    await cancel(token, placed.body.id).expect(409);

    // A cancelled order never fills, even when the price gets there
    await setPrice('40.00');
    await matcher.matchOnce();
    expect((await cash(token)).toFixed(2)).toBe('100000.00');
    await setPrice('100.00');
  });

  it('a cancel racing the matcher: exactly one of them wins, money stays consistent', async () => {
    const token = await signUp();
    const placed = await order(token, {
      side: 'BUY',
      type: 'LIMIT',
      quantity: 10,
      limitPrice: 90,
    });

    await setPrice('90.00');
    const [cancelResponse] = await Promise.all([
      cancel(token, placed.body.id),
      matcher.matchOnce(),
    ]);

    const final = await prisma.order.findUniqueOrThrow({
      where: { id: placed.body.id },
    });
    if (final.status === 'FILLED') {
      expect(cancelResponse.status).toBe(409);
      expect((await cash(token)).toFixed(2)).toBe('99100.00');
    } else {
      expect(final.status).toBe('CANCELLED');
      expect(cancelResponse.status).toBe(200);
      expect((await cash(token)).toFixed(2)).toBe('100000.00');
    }
    await setPrice('100.00');
  });

  it.each([
    ['a LIMIT without limitPrice', { side: 'BUY', type: 'LIMIT', quantity: 1 }],
    [
      'a limitPrice with 3 decimals',
      { side: 'BUY', type: 'LIMIT', quantity: 1, limitPrice: 1.234 },
    ],
    [
      'a negative limitPrice',
      { side: 'BUY', type: 'LIMIT', quantity: 1, limitPrice: -5 },
    ],
    [
      'a MARKET order with a limitPrice',
      { side: 'BUY', type: 'MARKET', quantity: 1, limitPrice: 5 },
    ],
  ])('returns 400 for %s', async (_, body) => {
    const token = await signUp();
    await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ symbol: 'AAPL', ...body })
      .expect(400);
  });
});
