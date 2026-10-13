import { afterEach, beforeEach, jest } from '@jest/globals';
import type { Candle } from '../market-data.types.js';
import { SimulatedMarketDataProvider } from './simulated.provider.js';

// New York time of a bar, as minutes after midnight
const nyMinutes = (candle: Candle): number => {
  const [hour, minute] = new Date(candle.time * 1000)
    .toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
    })
    .split(':')
    .map(Number);
  return hour * 60 + minute;
};

describe('SimulatedMarketDataProvider', () => {
  const provider = new SimulatedMarketDataProvider();

  // Tuesday 2026-10-13, 11:00 New York: the market is open
  const setNow = (iso: string) => jest.setSystemTime(new Date(iso));

  beforeEach(() => {
    jest.useFakeTimers();
    setNow('2026-10-13T15:00:00Z');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('labels its data as simulated', () => {
    expect(provider.source.kind).toBe('SIMULATED');
    expect(provider.timeframes).toEqual([
      '1m',
      '5m',
      '15m',
      '30m',
      '1h',
      '4h',
      '1D',
      '1W',
    ]);
  });

  it('is deterministic: the same moment always gives the same bars', async () => {
    const first = await provider.getCandles('AAPL', '5m', 50);
    const second = await provider.getCandles('AAPL', '5m', 50);

    expect(second).toEqual(first);
  });

  it('gives different stocks different prices', async () => {
    const apple = await provider.getQuote('AAPL');
    const tesla = await provider.getQuote('TSLA');

    expect(apple.price).not.toBe(tesla.price);
  });

  it.each(['1m', '15m', '1h', '4h', '1D', '1W'] as const)(
    '%s bars are valid OHLCV, oldest first',
    async (timeframe) => {
      const candles = await provider.getCandles('NVDA', timeframe, 200);

      expect(candles).toHaveLength(200);
      for (const [i, c] of candles.entries()) {
        expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close));
        expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close));
        expect(c.low).toBeGreaterThan(0);
        expect(c.volume).toBeGreaterThan(0);
        expect(Number.isInteger(c.volume)).toBe(true);
        if (i > 0) {
          expect(c.time).toBeGreaterThan(candles[i - 1].time);
        }
      }
    },
  );

  it('only has intraday bars during regular hours (9:30-16:00 New York)', async () => {
    const candles = await provider.getCandles('AAPL', '15m', 300);

    for (const candle of candles) {
      expect(nyMinutes(candle)).toBeGreaterThanOrEqual(9 * 60 + 30);
      expect(nyMinutes(candle)).toBeLessThan(16 * 60);
    }
  });

  it('starts weekly bars on Mondays', async () => {
    const candles = await provider.getCandles('AAPL', '1W', 20);

    for (const candle of candles) {
      expect(new Date(candle.time * 1000).getUTCDay()).toBe(1);
    }
  });

  it('agrees across timeframes: quote = last 1m close = last daily close', async () => {
    const quote = await provider.getQuote('MSFT');
    const [minute] = (await provider.getCandles('MSFT', '1m', 1)).slice(-1);
    const [day] = (await provider.getCandles('MSFT', '1D', 1)).slice(-1);

    expect(minute.close).toBe(quote.price);
    expect(day.close).toBe(quote.price);
  });

  it('computes the change from the previous close', async () => {
    const quote = await provider.getQuote('AAPL');
    const days = await provider.getCandles('AAPL', '1D', 2);

    expect(quote.previousClose).toBe(days[0].close);
    expect(quote.change).toBeCloseTo(quote.price - quote.previousClose, 2);
    expect(quote.changePercent).toBeCloseTo(
      (quote.change / quote.previousClose) * 100,
      2,
    );
  });

  it("freezes the price while the market is closed (at Friday's close)", async () => {
    setNow('2026-10-17T14:00:00Z'); // Saturday morning
    const saturday = await provider.getQuote('AAPL');
    setNow('2026-10-18T22:00:00Z'); // Sunday evening
    const sunday = await provider.getQuote('AAPL');

    expect(sunday.price).toBe(saturday.price);
    expect(saturday.timestamp).toBe('2026-10-16T20:00:00.000Z');
  });

  it('moves the price while the market is open', async () => {
    const before = await provider.getQuote('AAPL');
    setNow('2026-10-13T16:30:00Z');
    const after = await provider.getQuote('AAPL');

    expect(after.price).not.toBe(before.price);
  });

  it('gives a stock outside the universe a stable price', async () => {
    const first = await provider.getQuote('ZZTEST');
    const second = await provider.getQuote('ZZTEST');

    expect(first.price).toBeGreaterThan(0);
    expect(second.price).toBe(first.price);
  });
});
