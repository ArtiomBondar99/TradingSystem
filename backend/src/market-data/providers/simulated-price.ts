import { SESSION_SECONDS } from '../market-calendar.js';

/**
 * Deterministic fake prices: the price is a pure function of (symbol, time).
 * No state and no randomness at runtime, so the same bar always looks the
 * same, every timeframe agrees with the others, and tests can assert exact
 * values.
 *
 * Time is "trading time": seconds of regular session elapsed since a fixed
 * Monday. Nights and weekends add no trading time, so the price stands still
 * while the market is closed, like a real stock's last price.
 */

// Waves of different lengths stacked on top of each other (like octaves of
// "value noise"): slow ones make trends, fast ones make the wiggles.
// amplitude = how far (in log-price, ~percent) each wave can move the price.
const OCTAVES = [
  { period: 250 * SESSION_SECONDS, amplitude: 0.2 }, // ~1 year
  { period: 21 * SESSION_SECONDS, amplitude: 0.08 }, // ~1 month
  { period: 5 * SESSION_SECONDS, amplitude: 0.04 }, // ~1 week
  { period: SESSION_SECONDS, amplitude: 0.015 }, // 1 day
  { period: 3600, amplitude: 0.006 },
  { period: 900, amplitude: 0.003 },
  { period: 300, amplitude: 0.0018 },
  { period: 60, amplitude: 0.0008 },
  { period: 10, amplitude: 0.0003 },
];

// Monday 2000-01-03: trading time 0
const EPOCH_MS = Date.UTC(2000, 0, 3);
const DAY_MS = 24 * 60 * 60 * 1000;

/** Number of weekdays from the epoch to `date` (YYYY-MM-DD) */
export function weekdayIndex(date: string): number {
  const days = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - EPOCH_MS) / DAY_MS,
  );
  const weeks = Math.floor(days / 7);
  return weeks * 5 + Math.min(days - weeks * 7, 5);
}

/** Trading time of a moment `secondsIntoSession` after that day's open */
export function tradingSecond(
  date: string,
  secondsIntoSession: number,
): number {
  const clamped = Math.min(Math.max(secondsIntoSession, 0), SESSION_SECONDS);
  return weekdayIndex(date) * SESSION_SECONDS + clamped;
}

/** FNV-1a: turns a symbol into a 32-bit seed */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  }
  return hash >>> 0;
}

/** A pseudo-random number in [-1, 1], always the same for the same inputs */
export function random(seed: number, index: number): number {
  let h = (seed ^ Math.imul(index | 0, 0x27d4eb2d)) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

// Random values at whole numbers, smoothly blended in between
function valueNoise(seed: number, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const t = f * f * (3 - 2 * f); // smoothstep: no sharp corners at i
  const a = random(seed, i);
  const b = random(seed, i + 1);
  return a + (b - a) * t;
}

export function simulatedPrice(
  symbol: string,
  basePrice: number,
  tradingSec: number,
): number {
  const seed = hashString(symbol);
  let logOffset = 0;
  OCTAVES.forEach(({ period, amplitude }, octave) => {
    logOffset +=
      amplitude * valueNoise(seed + octave * 7919, tradingSec / period);
  });
  // exp() keeps the price positive and makes moves proportional (% based)
  return basePrice * Math.exp(logOffset);
}
