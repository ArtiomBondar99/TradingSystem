import { Injectable } from '@nestjs/common';
import { STOCK_UNIVERSE } from '../../stocks/stock-universe.js';
import {
  addDays,
  lastSession,
  previousTradingDay,
  SESSION_SECONDS,
  sessionClose,
  sessionOpen,
} from '../market-calendar.js';
import {
  TIMEFRAMES,
  type Candle,
  type DataSource,
  type Quote,
  type Timeframe,
} from '../market-data.types.js';
import type { MarketDataProvider } from './market-data.provider.js';
import {
  hashString,
  random,
  simulatedPrice,
  tradingSecond,
} from './simulated-price.js';

const INTRADAY_MINUTES: Partial<Record<Timeframe, number>> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '4h': 240,
};

// Prices sampled inside a bar to find its high and low
const SAMPLES_PER_BAR = 16;
const SAMPLES_PER_DAY = 32;

// A slice of one trading day that becomes one bar
type Bucket = { date: string; openMs: number; startMs: number; endMs: number };

/**
 * Development provider: generated prices, clearly labelled SIMULATED.
 * Bars exist only during regular hours (9:30-16:00 New York, trading days),
 * like a real exchange feed, and the last bar grows as time passes.
 */
@Injectable()
export class SimulatedMarketDataProvider implements MarketDataProvider {
  readonly source: DataSource = {
    provider: 'simulated',
    kind: 'SIMULATED',
    description: 'Generated prices for development. Not real market data.',
  };
  readonly timeframes = TIMEFRAMES;

  private readonly basePrices = new Map<string, number>(
    STOCK_UNIVERSE.map((stock) => [stock.symbol, Number(stock.basePrice)]),
  );

  getCandles(
    symbol: string,
    timeframe: Timeframe,
    limit: number,
  ): Promise<Candle[]> {
    const now = Date.now();
    const minutes = INTRADAY_MINUTES[timeframe];

    if (minutes) {
      return Promise.resolve(this.intradayCandles(symbol, minutes, limit, now));
    }
    if (timeframe === '1D') {
      return Promise.resolve(this.dailyCandles(symbol, limit, now));
    }
    return Promise.resolve(this.weeklyCandles(symbol, limit, now));
  }

  getQuote(symbol: string): Promise<Quote> {
    // While the market is closed, `until` is the last close: the price is frozen
    const { date, until } = lastSession(new Date());
    const price = round2(this.priceAt(symbol, date, until.getTime()));

    const previousDay = previousTradingDay(date);
    const previousClose = round2(
      this.priceAt(symbol, previousDay, sessionClose(previousDay).getTime()),
    );
    const change = round2(price - previousClose);

    return Promise.resolve({
      symbol,
      price,
      previousClose,
      change,
      changePercent: round2((change / previousClose) * 100),
      timestamp: until.toISOString(),
    });
  }

  private intradayCandles(
    symbol: string,
    minutes: number,
    limit: number,
    now: number,
  ): Candle[] {
    const stepMs = minutes * 60_000;
    let buckets: Bucket[] = [];
    let day = lastSession(new Date(now)).date;

    // Walk back one trading day at a time until there are enough bars.
    // Buckets start at the open (9:30, 9:35...); the last one of the day may
    // be shorter (e.g. 4h bars: 9:30-13:30 and 13:30-16:00).
    while (buckets.length < limit) {
      const openMs = sessionOpen(day).getTime();
      const closeMs = sessionClose(day).getTime();
      const dayBuckets: Bucket[] = [];
      for (
        let startMs = openMs;
        startMs < closeMs && startMs < now;
        startMs += stepMs
      ) {
        const endMs = Math.min(startMs + stepMs, closeMs, now);
        dayBuckets.push({ date: day, openMs, startMs, endMs });
      }
      buckets = dayBuckets.concat(buckets);
      day = previousTradingDay(day);
    }

    return buckets
      .slice(-limit)
      .map((bucket) => this.toCandle(symbol, bucket, SAMPLES_PER_BAR, true));
  }

  private dailyCandles(
    symbol: string,
    limit: number,
    now: number,
    samples = SAMPLES_PER_DAY,
  ): Candle[] {
    const candles: Candle[] = [];
    let day = lastSession(new Date(now)).date;

    while (candles.length < limit) {
      const openMs = sessionOpen(day).getTime();
      const endMs = Math.min(sessionClose(day).getTime(), now);
      const candle = this.toCandle(
        symbol,
        { date: day, openMs, startMs: openMs, endMs },
        samples,
        false,
      );
      // Daily bars are labelled with their date (midnight UTC), like most feeds
      candles.unshift({
        ...candle,
        time: Date.parse(`${day}T00:00:00Z`) / 1000,
      });
      day = previousTradingDay(day);
    }

    return candles;
  }

  // Weekly bars = the trading days of each Monday-Friday week merged together
  private weeklyCandles(symbol: string, limit: number, now: number): Candle[] {
    // Fewer samples per day: a week has 5x the days, and its high/low only
    // needs to be roughly right at this zoom level
    const days = this.dailyCandles(symbol, limit * 5 + 5, now, SAMPLES_PER_BAR);
    const weeks = new Map<number, Candle>();

    for (const day of days) {
      const date = new Date(day.time * 1000).toISOString().slice(0, 10);
      const weekday = new Date(day.time * 1000).getUTCDay();
      const monday =
        Date.parse(`${addDays(date, 1 - weekday)}T00:00:00Z`) / 1000;
      const week = weeks.get(monday);

      if (!week) {
        weeks.set(monday, { ...day, time: monday });
      } else {
        week.high = Math.max(week.high, day.high);
        week.low = Math.min(week.low, day.low);
        week.close = day.close;
        week.volume += day.volume;
      }
    }

    return [...weeks.values()].slice(-limit);
  }

  private toCandle(
    symbol: string,
    bucket: Bucket,
    samples: number,
    intraday: boolean,
  ): Candle {
    const prices: number[] = [];
    for (let i = 0; i <= samples; i++) {
      const ms =
        bucket.startMs + ((bucket.endMs - bucket.startMs) * i) / samples;
      prices.push(this.priceAt(symbol, bucket.date, ms, bucket.openMs));
    }

    return {
      time: bucket.startMs / 1000,
      open: round2(prices[0]),
      high: round2(Math.max(...prices)),
      low: round2(Math.min(...prices)),
      close: round2(prices[prices.length - 1]),
      volume: this.volume(symbol, bucket, intraday),
    };
  }

  private priceAt(
    symbol: string,
    date: string,
    ms: number,
    openMs = sessionOpen(date).getTime(),
  ): number {
    const secondsIntoSession = (ms - openMs) / 1000;
    return simulatedPrice(
      symbol,
      this.basePrice(symbol),
      tradingSecond(date, secondsIntoSession),
    );
  }

  private basePrice(symbol: string): number {
    // A stock outside the universe (e.g. one created by a test) still gets a
    // stable price: $20-$500, derived from its symbol
    return this.basePrices.get(symbol) ?? 20 + (hashString(symbol) % 480);
  }

  private volume(symbol: string, bucket: Bucket, intraday: boolean): number {
    const seed = hashString(symbol);
    // Each stock trades between 5M and 80M shares on an average day
    const dailyVolume = 5e6 + ((seed % 1000) / 1000) * 75e6;
    const fraction = (bucket.endMs - bucket.startMs) / 1000 / SESSION_SECONDS;

    // Real volume is U-shaped: busiest at the open and the close
    let shape = 1;
    if (intraday) {
      const middle =
        ((bucket.startMs + bucket.endMs) / 2 - bucket.openMs) /
        1000 /
        SESSION_SECONDS;
      shape = 0.7 + 0.9 * (2 * middle - 1) ** 2;
    }

    const noise =
      0.75 + 0.25 * random(seed ^ 0x5bd1e995, bucket.startMs / 60_000);
    return Math.round(dailyVolume * fraction * shape * noise);
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
