import { bollinger } from './bands.js';
import { pivotPoints, supportResistance, type Bar } from './levels.js';
import { ema, sma } from './moving-averages.js';
import { macd, rsi } from './oscillators.js';
import { vwap } from './vwap.js';

// Reference values were produced by the independent "technicalindicators"
// npm library (v3.1.0) from the same input, and are hard-coded here. They
// check our maths against another implementation, not against itself.

// The classic 33-close series used in RSI tutorials (StockCharts ChartSchool)
const CLOSES = [
  44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89,
  46.03, 45.61, 46.28, 46.28, 46.0, 46.03, 46.41, 46.22, 45.64, 46.21, 46.25,
  45.71, 46.45, 45.78, 45.35, 44.03, 44.18, 44.22, 44.57, 43.42, 42.66, 43.13,
];

// A longer, wavy series: enough bars for MACD(12, 26, 9) and Bollinger(20)
const WAVE = Array.from(
  { length: 120 },
  (_, i) =>
    +(100 + 10 * Math.sin(i / 7) + 3 * Math.cos(i / 3) + i * 0.1).toFixed(2),
);

const at = (series: (number | null)[], index: number) =>
  Number((series[index] as number).toFixed(4));

describe('indicator calculations', () => {
  describe('sma', () => {
    it('averages the last N values (hand-checked)', () => {
      expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
    });

    it('matches the reference library', () => {
      const result = sma(CLOSES, 10);
      expect(at(result, 9)).toBe(44.779);
      expect(at(result, 32)).toBe(44.379);
    });
  });

  describe('ema', () => {
    it('starts at the SMA, then weighs recent values more (hand-checked)', () => {
      // k = 2 / (3 + 1) = 0.5. Seed = (1+2+3)/3 = 2, then (4-2)*0.5+2 = 3,
      // then (11-3)*0.5+3 = 7
      expect(ema([1, 2, 3, 4, 11], 3)).toEqual([null, null, 2, 3, 7]);
    });

    it('matches the reference library', () => {
      const result = ema(CLOSES, 10);
      expect(at(result, 9)).toBe(44.779);
      expect(at(result, 32)).toBe(44.1193);
    });

    it('returns only nulls when there are fewer values than the period', () => {
      expect(ema([1, 2], 3)).toEqual([null, null]);
    });
  });

  describe('rsi', () => {
    it('matches the reference library (Wilder smoothing)', () => {
      const values = rsi(CLOSES, 14)
        .filter((v): v is number => v !== null)
        .map((v) => Number(v.toFixed(2)));

      expect(values).toEqual([
        70.46, 66.25, 66.48, 69.35, 66.29, 57.92, 62.88, 63.21, 56.01, 62.34,
        54.67, 50.39, 40.02, 41.49, 41.9, 45.5, 37.32, 33.09, 37.79,
      ]);
    });

    it('has its first value after `period` price changes', () => {
      const result = rsi(CLOSES, 14);
      expect(result.slice(0, 14).every((v) => v === null)).toBe(true);
      expect(result[14]).not.toBeNull();
    });

    it('is 100 when the price only went up, and stays within 0-100', () => {
      expect(rsi([1, 2, 3, 4, 5], 3).at(-1)).toBe(100);
      for (const value of rsi(WAVE, 14)) {
        if (value !== null) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(100);
        }
      }
    });
  });

  describe('macd', () => {
    it('matches the reference library (12, 26, 9)', () => {
      const result = macd(WAVE, 12, 26, 9);

      expect([
        at(result.macd, 119),
        at(result.signal, 119),
        at(result.histogram, 119),
      ]).toEqual([-2.3652, -0.774, -1.5912]);
      expect([
        at(result.macd, 117),
        at(result.signal, 117),
        at(result.histogram, 117),
      ]).toEqual([-1.4473, 0.0081, -1.4555]);
    });

    it('starts the MACD line at the slow EMA and the signal 8 bars later', () => {
      const result = macd(WAVE, 12, 26, 9);

      expect(result.macd[24]).toBeNull();
      expect(result.macd[25]).not.toBeNull();
      expect(result.signal[32]).toBeNull();
      expect(result.signal[33]).not.toBeNull();
    });
  });

  describe('bollinger', () => {
    it('matches the reference library (20, 2)', () => {
      const result = bollinger(WAVE, 20, 2);

      expect([
        at(result.upper, 19),
        at(result.middle, 19),
        at(result.lower, 19),
      ]).toEqual([112.2415, 107.9, 103.5585]);
      expect([
        at(result.upper, 119),
        at(result.middle, 119),
        at(result.lower, 119),
      ]).toEqual([121.1179, 111.3385, 101.5591]);
    });

    it('collapses onto the SMA when the price does not move', () => {
      const result = bollinger([5, 5, 5, 5], 3, 2);
      expect(result.upper.slice(2)).toEqual([5, 5]);
      expect(result.lower.slice(2)).toEqual([5, 5]);
    });
  });

  describe('vwap', () => {
    it('weights each bar by its volume and restarts every session (hand-checked)', () => {
      const result = vwap([
        // typical prices: 10, 20 | 30
        { high: 11, low: 9, close: 10, volume: 100, session: 'mon' },
        { high: 21, low: 19, close: 20, volume: 300, session: 'mon' },
        { high: 31, low: 29, close: 30, volume: 50, session: 'tue' },
      ]);

      // (10*100 + 20*300) / 400 = 17.5; Tuesday starts over at 30
      expect(result).toEqual([10, 17.5, 30]);
    });
  });

  describe('pivotPoints', () => {
    it('computes the classic floor-trader levels (hand-checked)', () => {
      // P = (110 + 90 + 100) / 3 = 100
      expect(pivotPoints({ high: 110, low: 90, close: 100, time: 0 })).toEqual({
        pivot: 100,
        r1: 110, // 2P - L
        s1: 90, // 2P - H
        r2: 120, // P + (H - L)
        s2: 80, // P - (H - L)
        r3: 130, // H + 2(P - L)
        s3: 70, // L - 2(H - P)
      });
    });
  });

  describe('supportResistance', () => {
    // Bounces between ~90 and ~110 three times, then ends at 100
    const prices = [
      100, 105, 110, 105, 100, 95, 90, 95, 100, 105, 110.5, 105, 100, 95, 90.4,
      95, 100, 105, 109.8, 105, 100,
    ];
    const bars: Bar[] = prices.map((price, i) => ({
      high: price + 0.2,
      low: price - 0.2,
      close: price,
      time: i,
    }));

    it('finds the levels the price kept bouncing off', () => {
      const { supports, resistances } = supportResistance(bars, {
        window: 2,
        maxLevels: 3,
        tolerance: 0.01,
      });

      expect(resistances).toHaveLength(1);
      expect(resistances[0].price).toBeCloseTo(110.3, 1);
      expect(resistances[0].touches).toBe(3);

      expect(supports).toHaveLength(1);
      expect(supports[0].price).toBeCloseTo(90, 0);
      expect(supports[0].touches).toBe(2);
    });

    it('keeps support below and resistance above the last close', () => {
      const { supports, resistances } = supportResistance(bars, {
        window: 2,
        maxLevels: 5,
        tolerance: 0.001,
      });

      expect(supports.every((level) => level.price < 100)).toBe(true);
      expect(resistances.every((level) => level.price >= 100)).toBe(true);
    });

    it('returns no levels for too few bars', () => {
      expect(
        supportResistance(bars.slice(0, 3), {
          window: 2,
          maxLevels: 3,
          tolerance: 0.01,
        }),
      ).toEqual({ supports: [], resistances: [] });
    });
  });
});
