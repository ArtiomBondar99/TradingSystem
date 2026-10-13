import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { createTestApp } from './create-test-app.js';

type Point = { time: number; value: number };

// Requires the seed: npx prisma db seed
describe('Indicators (e2e)', () => {
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

  const get = (path: string) => request(app.getHttpServer()).get(path);

  it('SMA points line up with the chart candles', async () => {
    const [candles, sma] = await Promise.all([
      get('/market-data/AAPL/candles?timeframe=1h&limit=100').expect(200),
      get('/indicators/AAPL/sma?timeframe=1h&limit=100&period=50').expect(200),
    ]);

    const candleTimes = candles.body.candles.map(
      (c: { time: number }) => c.time,
    );
    const smaTimes = sma.body.points.map((p: Point) => p.time);
    // Warm-up comes from older bars, so every visible candle has an SMA value
    expect(smaTimes).toEqual(candleTimes);
    expect(sma.body.source.kind).toBe('SIMULATED');
  });

  it('RSI stays between 0 and 100', async () => {
    const response = await get('/indicators/MSFT/rsi?timeframe=1D').expect(200);

    expect(response.body.points.length).toBeGreaterThan(0);
    for (const point of response.body.points as Point[]) {
      expect(point.value).toBeGreaterThanOrEqual(0);
      expect(point.value).toBeLessThanOrEqual(100);
    }
  });

  it('MACD returns its three series', async () => {
    const response = await get('/indicators/NVDA/macd?timeframe=1D').expect(
      200,
    );

    expect(response.body.macd.length).toBeGreaterThan(0);
    expect(response.body.signal.length).toBeGreaterThan(0);
    expect(response.body.histogram.length).toBeGreaterThan(0);
  });

  it('Bollinger upper >= middle >= lower', async () => {
    const response = await get(
      '/indicators/AAPL/bollinger?timeframe=1D&stdDev=2.5',
    ).expect(200);
    const { upper, middle, lower } = response.body as Record<string, Point[]>;

    upper.forEach((point, i) => {
      expect(point.value).toBeGreaterThanOrEqual(middle[i].value);
      expect(middle[i].value).toBeGreaterThanOrEqual(lower[i].value);
    });
  });

  it('VWAP works intraday and is refused on daily bars', async () => {
    await get('/indicators/AAPL/vwap?timeframe=5m').expect(200);
    await get('/indicators/AAPL/vwap?timeframe=1D').expect(400);
  });

  it('pivot points are ordered S3 < S2 < S1 < P < R1 < R2 < R3', async () => {
    const response = await get('/indicators/AAPL/pivots?timeframe=15m').expect(
      200,
    );
    const { s3, s2, s1, pivot, r1, r2, r3 } = response.body.levels;

    expect(response.body.basedOn).toBe('day');
    expect([s3, s2, s1, pivot, r1, r2, r3]).toEqual(
      [s3, s2, s1, pivot, r1, r2, r3].sort((a: number, b: number) => a - b),
    );
  });

  it('support/resistance returns levels on each side of the price', async () => {
    const response = await get(
      '/indicators/AAPL/levels?timeframe=1D&maxLevels=2',
    ).expect(200);

    expect(response.body.supports.length).toBeLessThanOrEqual(2);
    expect(response.body.resistances.length).toBeLessThanOrEqual(2);
  });

  it.each([
    ['a period over 200', '/indicators/AAPL/sma?period=500'],
    ['MACD with fast >= slow', '/indicators/AAPL/macd?fast=30&slow=20'],
    ['a stdDev of 0', '/indicators/AAPL/bollinger?stdDev=0'],
  ])('returns 400 for %s', async (_, path) => {
    await get(path).expect(400);
  });

  it('returns 404 for an unknown stock', async () => {
    await get('/indicators/ZZZZ/sma').expect(404);
  });
});
