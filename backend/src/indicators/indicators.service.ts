import { BadRequestException, Injectable } from '@nestjs/common';
import { MAX_CANDLES } from '../market-data/dto/market-data-query.dto.js';
import type { DataSourceDto } from '../market-data/dto/market-data-response.dto.js';
import { etDate } from '../market-data/market-calendar.js';
import type { Candle, Timeframe } from '../market-data/market-data.types.js';
import { MarketDataService } from '../market-data/market-data.service.js';
import { bollinger } from './calculations/bands.js';
import {
  pivotPoints,
  supportResistance,
  type Bar,
  type PriceLevel,
} from './calculations/levels.js';
import { ema, sma, type Series } from './calculations/moving-averages.js';
import { macd, rsi } from './calculations/oscillators.js';
import { vwap } from './calculations/vwap.js';
import type {
  BollingerResponseDto,
  IndicatorPointDto,
  LevelsResponseDto,
  LineIndicatorResponseDto,
  MacdResponseDto,
  PivotsResponseDto,
} from './dto/indicator-response.dto.js';

const INTRADAY: readonly Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h'];

// The candles an indicator is computed from, and which of them the chart shows
type Window = {
  symbol: string;
  timeframe: Timeframe;
  source: DataSourceDto;
  candles: Candle[];
  // Time of the first bar on the chart; earlier bars are only warm-up
  firstVisible: number;
};

/**
 * Computes indicators from the same candles the chart shows (through
 * MarketDataService, so they share its cache and its 404/503 handling).
 *
 * Warm-up: a 200-period SMA needs 199 bars before its first value. So we
 * always load MAX_CANDLES bars, compute on all of them, and return only the
 * points of the last `limit` bars: the line then covers the whole chart.
 */
@Injectable()
export class IndicatorsService {
  constructor(private readonly marketData: MarketDataService) {}

  async sma(
    symbol: string,
    timeframe: Timeframe,
    limit: number,
    period: number,
  ): Promise<LineIndicatorResponseDto> {
    const window = await this.load(symbol, timeframe, limit);
    return this.line(window, sma(closes(window), period));
  }

  async ema(
    symbol: string,
    timeframe: Timeframe,
    limit: number,
    period: number,
  ): Promise<LineIndicatorResponseDto> {
    const window = await this.load(symbol, timeframe, limit);
    return this.line(window, ema(closes(window), period));
  }

  async rsi(
    symbol: string,
    timeframe: Timeframe,
    limit: number,
    period: number,
  ): Promise<LineIndicatorResponseDto> {
    const window = await this.load(symbol, timeframe, limit);
    return this.line(window, rsi(closes(window), period));
  }

  async macd(
    symbol: string,
    timeframe: Timeframe,
    limit: number,
    fast: number,
    slow: number,
    signal: number,
  ): Promise<MacdResponseDto> {
    if (fast >= slow) {
      throw new BadRequestException('fast must be smaller than slow');
    }
    const window = await this.load(symbol, timeframe, limit);
    const result = macd(closes(window), fast, slow, signal);

    return {
      ...meta(window),
      macd: points(window, result.macd),
      signal: points(window, result.signal),
      histogram: points(window, result.histogram),
    };
  }

  async bollinger(
    symbol: string,
    timeframe: Timeframe,
    limit: number,
    period: number,
    stdDev: number,
  ): Promise<BollingerResponseDto> {
    const window = await this.load(symbol, timeframe, limit);
    const result = bollinger(closes(window), period, stdDev);

    return {
      ...meta(window),
      upper: points(window, result.upper),
      middle: points(window, result.middle),
      lower: points(window, result.lower),
    };
  }

  async vwap(
    symbol: string,
    timeframe: Timeframe,
    limit: number,
  ): Promise<LineIndicatorResponseDto> {
    if (!INTRADAY.includes(timeframe)) {
      // VWAP restarts every trading day: on a daily bar it is just that bar
      throw new BadRequestException(
        'VWAP is an intraday indicator: use a timeframe below 1D',
      );
    }
    const window = await this.load(symbol, timeframe, limit);
    const series = vwap(
      window.candles.map((c) => ({
        ...c,
        // Bars of the same New York trading day share a session
        session: etDate(new Date(c.time * 1000)),
      })),
    );
    return this.line(window, series);
  }

  /**
   * Pivot points for the current period come from the PREVIOUS completed
   * one: intraday charts use yesterday, daily charts last week, weekly charts
   * last month. The higher-timeframe bar before the latest one is that period.
   */
  async pivots(
    symbol: string,
    timeframe: Timeframe,
    limit: number,
  ): Promise<PivotsResponseDto> {
    const window = await this.load(symbol, timeframe, limit);

    let basedOn: PivotsResponseDto['basedOn'];
    let previous: Bar | undefined;

    if (INTRADAY.includes(timeframe)) {
      basedOn = 'day';
      previous = (await this.marketData.getCandles(symbol, '1D', 2)).candles.at(
        -2,
      );
    } else if (timeframe === '1D') {
      basedOn = 'week';
      previous = (await this.marketData.getCandles(symbol, '1W', 2)).candles.at(
        -2,
      );
    } else {
      basedOn = 'month';
      const weeks = (await this.marketData.getCandles(symbol, '1W', 12))
        .candles;
      previous = byMonth(weeks).at(-2);
    }

    if (!previous) {
      throw new BadRequestException('Not enough history for pivot points');
    }

    const levels = pivotPoints(previous);
    return {
      ...meta(window),
      basedOn,
      periodStart: previous.time,
      levels: {
        pivot: round(levels.pivot),
        r1: round(levels.r1),
        r2: round(levels.r2),
        r3: round(levels.r3),
        s1: round(levels.s1),
        s2: round(levels.s2),
        s3: round(levels.s3),
      },
    };
  }

  // Support/resistance from the bars on the chart (not the warm-up)
  async levels(
    symbol: string,
    timeframe: Timeframe,
    limit: number,
    window: number,
    maxLevels: number,
    tolerancePercent: number,
  ): Promise<LevelsResponseDto> {
    const data = await this.load(symbol, timeframe, limit);
    const visible = data.candles.filter((c) => c.time >= data.firstVisible);
    const result = supportResistance(visible, {
      window,
      maxLevels,
      tolerance: tolerancePercent / 100,
    });

    const rounded = (level: PriceLevel) => ({
      ...level,
      price: round(level.price),
    });
    return {
      ...meta(data),
      supports: result.supports.map(rounded),
      resistances: result.resistances.map(rounded),
    };
  }

  private async load(
    symbol: string,
    timeframe: Timeframe,
    limit: number,
  ): Promise<Window> {
    const { source, candles } = await this.marketData.getCandles(
      symbol,
      timeframe,
      MAX_CANDLES,
    );
    const firstVisible = candles.at(-limit)?.time ?? candles[0]?.time ?? 0;
    return { symbol, timeframe, source, candles, firstVisible };
  }

  private line(window: Window, series: Series): LineIndicatorResponseDto {
    return { ...meta(window), points: points(window, series) };
  }
}

function closes(window: Window): number[] {
  return window.candles.map((c) => c.close);
}

function meta({ symbol, timeframe, source }: Window) {
  return { symbol, timeframe, source };
}

// Pairs each value with its candle's time; drops the warm-up and the bars
// that are off the chart
function points(window: Window, series: Series): IndicatorPointDto[] {
  const result: IndicatorPointDto[] = [];
  window.candles.forEach((candle, i) => {
    const value = series[i];
    if (value !== null && candle.time >= window.firstVisible) {
      result.push({ time: candle.time, value: round(value) });
    }
  });
  return result;
}

// 4 decimals: precise enough for any chart, and keeps the JSON small
function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

// Weekly bars merged into calendar months (by the month of their Monday)
function byMonth(weeks: Candle[]): Bar[] {
  const months = new Map<string, Bar>();
  for (const week of weeks) {
    const key = new Date(week.time * 1000).toISOString().slice(0, 7);
    const month = months.get(key);
    if (!month) {
      months.set(key, {
        high: week.high,
        low: week.low,
        close: week.close,
        time: week.time,
      });
    } else {
      month.high = Math.max(month.high, week.high);
      month.low = Math.min(month.low, week.low);
      month.close = week.close;
    }
  }
  return [...months.values()];
}
