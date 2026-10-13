import {
  ema,
  emaOfSeries,
  emptySeries,
  type Series,
} from './moving-averages.js';

/**
 * Relative Strength Index (Wilder), 0-100. Above 70 is usually read as
 * "overbought", below 30 as "oversold".
 *
 * RSI = 100 - 100 / (1 + averageGain / averageLoss)
 * The first averages are plain averages of the first `period` changes; after
 * that Wilder smoothing: average = (previous * (period - 1) + current) / period.
 */
export function rsi(closes: number[], period: number): Series {
  const result: Series = emptySeries(closes.length);
  if (closes.length <= period) {
    return result;
  }

  let averageGain = 0;
  let averageLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    averageGain += Math.max(change, 0) / period;
    averageLoss += Math.max(-change, 0) / period;
  }
  result[period] = toRsi(averageGain, averageLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    averageGain = (averageGain * (period - 1) + Math.max(change, 0)) / period;
    averageLoss = (averageLoss * (period - 1) + Math.max(-change, 0)) / period;
    result[i] = toRsi(averageGain, averageLoss);
  }

  return result;
}

function toRsi(averageGain: number, averageLoss: number): number {
  // Only gains in the window: RS is infinite, RSI is 100
  if (averageLoss === 0) {
    return averageGain === 0 ? 50 : 100;
  }
  return 100 - 100 / (1 + averageGain / averageLoss);
}

export type MacdResult = { macd: Series; signal: Series; histogram: Series };

/**
 * MACD: the gap between a fast and a slow EMA (momentum), a signal line
 * (EMA of that gap), and the histogram (MACD - signal). Defaults 12, 26, 9.
 */
export function macd(
  closes: number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number,
): MacdResult {
  const fast = ema(closes, fastPeriod);
  const slow = ema(closes, slowPeriod);

  const macdLine: Series = closes.map((_, i) =>
    fast[i] !== null && slow[i] !== null ? fast[i] - slow[i] : null,
  );
  const signal = emaOfSeries(macdLine, signalPeriod);
  const histogram: Series = macdLine.map((value, i) =>
    value !== null && signal[i] !== null ? value - signal[i] : null,
  );

  return { macd: macdLine, signal, histogram };
}
