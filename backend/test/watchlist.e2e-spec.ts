import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { createTestApp } from './create-test-app.js';

// Requires the seed: npx prisma db seed
describe('Watchlist (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = createTestApp(moduleFixture);
    // Listening up front: the parallel requests below would each start it
    await app.listen(0);
  });

  afterAll(async () => {
    await app.close();
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

  const add = (token: string, symbol: string) =>
    request(app.getHttpServer())
      .put(`/watchlist/${symbol}`)
      .set('Authorization', `Bearer ${token}`);

  const remove = (token: string, symbol: string) =>
    request(app.getHttpServer())
      .delete(`/watchlist/${symbol}`)
      .set('Authorization', `Bearer ${token}`);

  const list = async (token: string): Promise<string[]> => {
    const response = await request(app.getHttpServer())
      .get('/watchlist')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return response.body.map((item: { symbol: string }) => item.symbol);
  };

  it('adds and removes stocks, in the order they were added', async () => {
    const token = await signUp();

    await add(token, 'MSFT').expect(204);
    await add(token, 'aapl').expect(204); // case-insensitive
    expect(await list(token)).toEqual(['MSFT', 'AAPL']);

    await remove(token, 'MSFT').expect(204);
    expect(await list(token)).toEqual(['AAPL']);
  });

  it('returns the price with the item', async () => {
    const token = await signUp();
    await add(token, 'AAPL').expect(204);

    const response = await request(app.getHttpServer())
      .get('/watchlist')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body[0]).toMatchObject({
      symbol: 'AAPL',
      name: expect.any(String),
      currentPrice: expect.stringMatching(/^\d+\.\d{2}$/),
    });
  });

  it('is idempotent: repeating PUT or DELETE changes nothing', async () => {
    const token = await signUp();

    await add(token, 'TSLA').expect(204);
    await add(token, 'TSLA').expect(204);
    expect(await list(token)).toEqual(['TSLA']);

    await remove(token, 'TSLA').expect(204);
    await remove(token, 'TSLA').expect(204);
    expect(await list(token)).toEqual([]);
  });

  it('adds a stock once even under parallel requests (double clicks)', async () => {
    const token = await signUp();

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => add(token, 'NVDA')),
    );

    expect(responses.every((r) => r.status === 204)).toBe(true);
    expect(await list(token)).toEqual(['NVDA']);
  });

  it("shows only the current user's list", async () => {
    const alice = await signUp();
    const bob = await signUp();

    await add(alice, 'KO').expect(204);

    expect(await list(bob)).toEqual([]);
  });

  it('returns 404 for a stock we do not list, 400 for an invalid symbol', async () => {
    const token = await signUp();

    await add(token, 'ZZZZ').expect(404);
    await add(token, 'not-a-symbol!').expect(400);
  });

  it('requires a login', async () => {
    await request(app.getHttpServer()).get('/watchlist').expect(401);
  });
});
