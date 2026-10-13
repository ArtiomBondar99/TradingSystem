import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { Prisma } from './../src/generated/prisma/client.js';
import { createTestApp } from './create-test-app.js';

const STARTING_CASH = new Prisma.Decimal('100000');
const PARALLEL_REQUESTS = 10;

// Requires the seed: npx prisma db seed
// These tests prove the wallet lock (SELECT ... FOR UPDATE) and the
// Idempotency-Key work under real concurrency, against the real database.
// Remove the lock and they fail.
describe('Orders (e2e)', () => {
  let app: INestApplication<App>;
  let price: Prisma.Decimal;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = createTestApp(moduleFixture);
    // Listen once up front: parallel supertest calls on a server that isn't
    // listening yet would each try to start it
    await app.listen(0);

    const stock = await request(app.getHttpServer())
      .get('/stocks/AAPL')
      .expect(200);
    price = new Prisma.Decimal(stock.body.currentPrice);
  });

  afterAll(async () => {
    await app.close();
  });

  // A fresh user per test: $100,000 and no shares, isolated from other tests
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

  const placeOrder = (
    token: string,
    body: object,
    idempotencyKey?: string,
  ): request.Test => {
    const req = request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

    return idempotencyKey ? req.set('Idempotency-Key', idempotencyKey) : req;
  };

  const placeInParallel = (send: () => request.Test) =>
    Promise.all(Array.from({ length: PARALLEL_REQUESTS }, () => send()));

  const cashBalance = async (token: string): Promise<Prisma.Decimal> => {
    const wallet = await request(app.getHttpServer())
      .get('/wallet')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    return new Prisma.Decimal(wallet.body.cashBalance);
  };

  const countByStatus = (responses: request.Response[], status: string) =>
    responses.filter((r) => r.body.status === status).length;

  it('parallel BUYs never spend more cash than the wallet holds', async () => {
    const token = await signUp();

    // Each order costs about a third of the wallet, so only a few can fit
    const quantity = STARTING_CASH.div(price).div(3).floor().toNumber();
    const orderCost = price.mul(quantity);
    const affordable = STARTING_CASH.div(orderCost).floor().toNumber();

    const responses = await placeInParallel(() =>
      placeOrder(token, { symbol: 'AAPL', side: 'BUY', quantity }),
    );

    expect(responses.every((r) => r.status === 201)).toBe(true);
    expect(countByStatus(responses, 'FILLED')).toBe(affordable);
    expect(countByStatus(responses, 'REJECTED')).toBe(
      PARALLEL_REQUESTS - affordable,
    );

    const balance = await cashBalance(token);
    expect(balance.isNegative()).toBe(false);
    expect(balance.equals(STARTING_CASH.sub(orderCost.mul(affordable)))).toBe(
      true,
    );
  });

  it('parallel SELLs never sell more shares than the user holds', async () => {
    const token = await signUp();
    const owned = 6;

    await placeOrder(token, {
      symbol: 'AAPL',
      side: 'BUY',
      quantity: owned,
    }).expect(201);

    const responses = await placeInParallel(() =>
      placeOrder(token, { symbol: 'AAPL', side: 'SELL', quantity: 1 }),
    );

    expect(countByStatus(responses, 'FILLED')).toBe(owned);
    expect(countByStatus(responses, 'REJECTED')).toBe(
      PARALLEL_REQUESTS - owned,
    );
    responses
      .filter((r) => r.body.status === 'REJECTED')
      .forEach((r) => expect(r.body.rejectReason).toBe('INSUFFICIENT_SHARES'));

    // Bought 6 and sold 6 at the same price: all cash is back, no shares left
    expect((await cashBalance(token)).equals(STARTING_CASH)).toBe(true);

    const portfolio = await request(app.getHttpServer())
      .get('/portfolio')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(portfolio.body.positions).toEqual([]);
  });

  it('parallel retries with the same Idempotency-Key trade only once', async () => {
    const token = await signUp();
    const key = randomUUID();
    const quantity = 5;

    const responses = await placeInParallel(() =>
      placeOrder(token, { symbol: 'AAPL', side: 'BUY', quantity }, key),
    );

    expect(responses.every((r) => r.status === 201)).toBe(true);
    // Every retry got back the very same order
    const orderIds = new Set(responses.map((r) => r.body.id));
    expect(orderIds.size).toBe(1);

    // ...and the money left the wallet exactly once
    const balance = await cashBalance(token);
    expect(balance.equals(STARTING_CASH.sub(price.mul(quantity)))).toBe(true);

    const transactions = await request(app.getHttpServer())
      .get('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(transactions.body.items).toHaveLength(1);
  });

  it('returns 422 when an Idempotency-Key is reused for a different order', async () => {
    const token = await signUp();
    const key = randomUUID();

    await placeOrder(
      token,
      { symbol: 'AAPL', side: 'BUY', quantity: 1 },
      key,
    ).expect(201);

    await placeOrder(
      token,
      { symbol: 'AAPL', side: 'BUY', quantity: 2 },
      key,
    ).expect(422);
  });

  it('returns 400 when the Idempotency-Key is not a UUID', async () => {
    const token = await signUp();

    await placeOrder(
      token,
      { symbol: 'AAPL', side: 'BUY', quantity: 1 },
      'not-a-uuid',
    ).expect(400);
  });

  describe('GET /orders (order history)', () => {
    const listOrders = (token: string, query = '') =>
      request(app.getHttpServer())
        .get(`/orders${query}`)
        .set('Authorization', `Bearer ${token}`);

    it('shows every order newest first, REJECTED ones included', async () => {
      const token = await signUp();
      await placeOrder(token, { symbol: 'AAPL', side: 'BUY', quantity: 1 });
      await placeOrder(token, { symbol: 'AAPL', side: 'BUY', quantity: 1e6 });

      const response = await listOrders(token).expect(200);

      expect(response.body.items).toMatchObject([
        { status: 'REJECTED', rejectReason: 'INSUFFICIENT_FUNDS' },
        { status: 'FILLED', symbol: 'AAPL', quantity: 1 },
      ]);
      expect(response.body.nextCursor).toBeNull();
    });

    it('filters by status', async () => {
      const token = await signUp();
      await placeOrder(token, { symbol: 'AAPL', side: 'BUY', quantity: 1 });
      await placeOrder(token, { symbol: 'AAPL', side: 'SELL', quantity: 5 });

      const response = await listOrders(token, '?status=REJECTED').expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].rejectReason).toBe('INSUFFICIENT_SHARES');
    });

    it('pages through the history with the cursor', async () => {
      const token = await signUp();
      for (const quantity of [1, 2, 3]) {
        await placeOrder(token, { symbol: 'AAPL', side: 'BUY', quantity });
      }

      const first = await listOrders(token, '?limit=2').expect(200);
      const second = await listOrders(
        token,
        `?limit=2&cursor=${first.body.nextCursor}`,
      ).expect(200);

      const quantities = [...first.body.items, ...second.body.items].map(
        (o: { quantity: number }) => o.quantity,
      );
      expect(quantities).toEqual([3, 2, 1]);
      expect(second.body.nextCursor).toBeNull();
    });

    it('shows only the current user’s orders', async () => {
      const alice = await signUp();
      const bob = await signUp();
      await placeOrder(alice, { symbol: 'AAPL', side: 'BUY', quantity: 1 });

      const response = await listOrders(bob).expect(200);

      expect(response.body.items).toEqual([]);
    });

    it('returns 400 for an unknown status', async () => {
      const token = await signUp();

      await listOrders(token, '?status=DONE').expect(400);
    });
  });
});
