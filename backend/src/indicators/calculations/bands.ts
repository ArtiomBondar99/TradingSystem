import { emptySeries, sma, type Series } from './moving-averages.js';

export type BollingerResult = { upper: Series; middle: Series; lower: Series };

/**
 * Bollinger Bands: an SMA with a band `stdDev` standard deviations above and
 * below it. The bands widen when the price is volatile and narrow when it
 * is calm. Uses the population standard deviation (divide by N), as
 * John Bollinger defines it. Defaults 20, 2.
 */
export function bollinger(
  closes: number[],
  period: number,
  stdDev: number,
): BollingerResult {
  const middle = sma(closes, period);
  const upper: Series = emptySeries(closes.length);
  const lower: Series = emptySeries(closes.length);

  for (let i = period - 1; i < closes.length; i++) {
    const mean = middle[i] as number;
    let squares = 0;
    for (let j = i - period + 1; j <= i; j++) {
      squares += (closes[j] - mean) ** 2;
    }
    const deviation = Math.sqrt(squares / period);
    upper[i] = mean + stdDev * deviation;
    lower[i] = mean - stdDev * deviation;
  }

  return { upper, middle, lower };
}
