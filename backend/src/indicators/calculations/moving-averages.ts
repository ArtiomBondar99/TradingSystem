// Every calculation in this folder is a pure function: numbers in, numbers
// out, no Nest, no database. The output is aligned with the input: result[i]
// belongs to bar i, and is null while there are not enough bars yet (the
// "warm-up"), e.g. the first 19 values of a 20-period SMA.

export type Series = (number | null)[];

// All nulls: the starting point before any value is known
export function emptySeries(length: number): Series {
  return Array.from({ length }, () => null);
}

/** Simple Moving Average: the plain average of the last `period` values */
export function sma(values: number[], period: number): Series {
  const result: Series = emptySeries(values.length);
  let sum = 0;

  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    // Sliding window: add the newest value, drop the one that fell out
    if (i >= period) {
      sum -= values[i - period];
    }
    if (i >= period - 1) {
      result[i] = sum / period;
    }
  }

  return result;
}

/**
 * Exponential Moving Average: recent values weigh more.
 * EMA = (value - previousEMA) * k + previousEMA, with k = 2 / (period + 1).
 * Seeded with the SMA of the first `period` values (the common convention,
 * used by StockCharts and most libraries).
 */
export function ema(values: number[], period: number): Series {
  const result: Series = emptySeries(values.length);
  if (values.length < period) {
    return result;
  }

  const k = 2 / (period + 1);
  let previous = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period - 1] = previous;

  for (let i = period; i < values.length; i++) {
    previous = (values[i] - previous) * k + previous;
    result[i] = previous;
  }

  return result;
}

/** EMA of a series that itself starts with nulls (e.g. the MACD line) */
export function emaOfSeries(series: Series, period: number): Series {
  const start = series.findIndex((value) => value !== null);
  const result: Series = emptySeries(series.length);
  if (start === -1) {
    return result;
  }

  const tail = ema(series.slice(start) as number[], period);
  tail.forEach((value, i) => (result[start + i] = value));
  return result;
}
