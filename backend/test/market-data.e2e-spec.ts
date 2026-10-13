import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { createTestApp } from './create-test-app.js';

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

// Requires the seed: npx prisma db seed
describe('Market data (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = createTestApp(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /market-data/source says the data is simulated', async () => {
    const response = await request(app.getHttpServer())
      .get('/market-data/source')
      .expect(200);

    expect(response.body).toMatchObject({
      provider: 'simulated',
      kind: 'SIMULATED',
    });
    expect(response.body.timeframes).toContain('1D');
  });

  it('GET /market-data/status reports the US market session', async () => {
    const response = await request(app.getHttpServer())
      .get('/market-data/status')
      .expect(200);

    expect(response.body).toMatchObject({
      isOpen: expect.any(Boolean),
      session: expect.stringMatching(
        /^(PRE_MARKET|REGULAR|AFTER_HOURS|CLOSED)$/,
      ),
      timezone: 'America/New_York',
    });
  });

  it('GET /market-data/search finds stocks by name', async () => {
    const response = await request(app.getHttpServer())
      .get('/market-data/search?q=apple')
      .expect(200);

    expect(response.body[0]).toEqual({ symbol: 'AAPL', name: 'Apple Inc.' });
  });

  it('GET /market-data/search requires a query', async () => {
    await request(app.getHttpServer())
      .get('/market-data/search?q=')
      .expect(400);
  });

  it('GET /market-data/:symbol/candles returns daily bars by default', async () => {
    const response = await request(app.getHttpServer())
      .get('/market-data/aapl/candles')
      .expect(200);

    expect(response.body).toMatchObject({
      symbol: 'AAPL',
      timeframe: '1D',
      source: { kind: 'SIMULATED' },
    });
    const candles: Candle[] = response.body.candles;
    expect(candles).toHaveLength(300);
    for (const c of candles) {
      expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close));
      expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close));
    }
  });

  it('GET /market-data/:symbol/candles accepts a timeframe and limit', async () => {
    const response = await request(app.getHttpServer())
      .get('/market-data/MSFT/candles?timeframe=5m&limit=50')
      .expect(200);

    expect(response.body.timeframe).toBe('5m');
    expect(response.body.candles).toHaveLength(50);
  });

  it.each([
    ['an unknown timeframe', 'timeframe=2h'],
    ['a limit over 1000', 'limit=5000'],
    ['a non-numeric limit', 'limit=abc'],
  ])(
    'GET /market-data/:symbol/candles returns 400 for %s',
    async (_, query) => {
      await request(app.getHttpServer())
        .get(`/market-data/AAPL/candles?${query}`)
        .expect(400);
    },
  );

  it('GET /market-data/:symbol/candles returns 404 for an unknown stock', async () => {
    await request(app.getHttpServer())
      .get('/market-data/ZZZZ/candles')
      .expect(404);
  });

  it('GET /market-data/:symbol/quote returns the price and daily change', async () => {
    const response = await request(app.getHttpServer())
      .get('/market-data/AAPL/quote')
      .expect(200);

    expect(response.body).toMatchObject({
      symbol: 'AAPL',
      price: expect.any(Number),
      previousClose: expect.any(Number),
      change: expect.any(Number),
      changePercent: expect.any(Number),
      timestamp: expect.any(String),
      source: { kind: 'SIMULATED' },
    });
  });
});
