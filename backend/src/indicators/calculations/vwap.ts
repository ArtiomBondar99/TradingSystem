import type { Series } from './moving-averages.js';

export type VwapBar = {
  high: number;
  low: number;
  close: number;
  volume: number;
  // Bars with the same session key belong to the same trading day
  session: string;
};

/**
 * Volume Weighted Average Price: the average price paid today, where each
 * bar counts as much as the shares traded in it.
 * VWAP = sum(typicalPrice * volume) / sum(volume), typicalPrice = (H + L + C) / 3.
 * Starts over at every new session, so it only makes sense intraday.
 */
export function vwap(bars: VwapBar[]): Series {
  let session: string | null = null;
  let priceVolume = 0;
  let volume = 0;

  return bars.map((bar) => {
    if (bar.session !== session) {
      session = bar.session;
      priceVolume = 0;
      volume = 0;
    }

    priceVolume += ((bar.high + bar.low + bar.close) / 3) * bar.volume;
    volume += bar.volume;
    return volume === 0 ? null : priceVolume / volume;
  });
}
