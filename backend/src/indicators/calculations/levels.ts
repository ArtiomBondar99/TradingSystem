export type Bar = { high: number; low: number; close: number; time: number };

export type PivotLevels = {
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
};

/**
 * Classic (floor trader) pivot points, from the previous period's high, low
 * and close. Traders watch them as likely turning points for this period.
 */
export function pivotPoints({ high, low, close }: Bar): PivotLevels {
  const pivot = (high + low + close) / 3;
  return {
    pivot,
    r1: 2 * pivot - low,
    s1: 2 * pivot - high,
    r2: pivot + (high - low),
    s2: pivot - (high - low),
    r3: high + 2 * (pivot - low),
    s3: low - 2 * (high - pivot),
  };
}

export type PriceLevel = {
  price: number;
  // How many swing highs/lows formed at this level: more = stronger
  touches: number;
  // Most recent of those swings (Unix seconds)
  lastTouch: number;
};

export type SupportResistance = {
  supports: PriceLevel[];
  resistances: PriceLevel[];
};

export type LevelOptions = {
  // A swing high is the highest high of `window` bars on each side
  window: number;
  // Keep at most this many levels on each side of the price
  maxLevels: number;
  // Swings within this fraction of each other (0.01 = 1%) are one level
  tolerance: number;
};

/**
 * Support and resistance from swing points:
 * 1. Find swing highs and lows (local peaks and troughs).
 * 2. Merge the ones at nearly the same price into one level; each merged
 *    swing is a "touch".
 * 3. Levels below the last close are supports, above it resistances (a
 *    broken resistance becomes support, so both kinds feed one pool).
 * 4. Keep the strongest (most touches, then most recent), nearest first.
 */
export function supportResistance(
  bars: Bar[],
  { window, maxLevels, tolerance }: LevelOptions,
): SupportResistance {
  const swings: { price: number; time: number }[] = [];

  for (let i = window; i < bars.length - window; i++) {
    const around = bars.slice(i - window, i + window + 1);
    if (bars[i].high === Math.max(...around.map((b) => b.high))) {
      swings.push({ price: bars[i].high, time: bars[i].time });
    }
    if (bars[i].low === Math.min(...around.map((b) => b.low))) {
      swings.push({ price: bars[i].low, time: bars[i].time });
    }
  }

  // Cluster: walk the swings by price and merge neighbours that are close
  swings.sort((a, b) => a.price - b.price);
  const clusters: { prices: number[]; lastTouch: number }[] = [];
  for (const swing of swings) {
    const current = clusters.at(-1);
    const mean = current ? average(current.prices) : 0;
    if (current && swing.price - mean <= mean * tolerance) {
      current.prices.push(swing.price);
      current.lastTouch = Math.max(current.lastTouch, swing.time);
    } else {
      clusters.push({ prices: [swing.price], lastTouch: swing.time });
    }
  }

  const levels: PriceLevel[] = clusters.map((cluster) => ({
    price: average(cluster.prices),
    touches: cluster.prices.length,
    lastTouch: cluster.lastTouch,
  }));

  const lastClose = bars.at(-1)?.close ?? 0;
  const strongest = (a: PriceLevel, b: PriceLevel) =>
    b.touches - a.touches || b.lastTouch - a.lastTouch;
  const nearest = (a: PriceLevel, b: PriceLevel) =>
    Math.abs(a.price - lastClose) - Math.abs(b.price - lastClose);

  const pick = (side: PriceLevel[]) =>
    side.sort(strongest).slice(0, maxLevels).sort(nearest);

  return {
    supports: pick(levels.filter((level) => level.price < lastClose)),
    resistances: pick(levels.filter((level) => level.price >= lastClose)),
  };
}

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}
