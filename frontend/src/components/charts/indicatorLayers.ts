import type { IndicatorQueries } from '../../hooks/useIndicators';
import type { IndicatorSettings } from '../../hooks/useIndicatorSettings';
import type { IndicatorPoint } from '../../services/types';

// Turns indicator data into generic drawing instructions for PriceChart:
// "a line here, a horizontal level there, a pane below with these series".
// PriceChart then needs no knowledge of what an RSI or a pivot point is.

export type LineLayer = {
  id: string;
  label: string;
  color: string;
  points: IndicatorPoint[];
  dashed?: boolean;
};

export type HistogramLayer = {
  id: string;
  label: string;
  points: IndicatorPoint[];
  upColor: string;
  downColor: string;
};

export type PriceLevelLayer = {
  id: string;
  title: string;
  price: number;
  color: string;
  dashed: boolean;
};

export type PaneLayer = {
  id: string;
  lines: LineLayer[];
  histograms: HistogramLayer[];
  // Horizontal guides, e.g. RSI 30 and 70
  guides: { price: number; color: string }[];
};

export type ChartLayers = {
  overlays: LineLayer[];
  levels: PriceLevelLayer[];
  panes: PaneLayer[];
};

export const INDICATOR_COLORS = {
  sma: '#ff9800',
  ema: '#e040fb',
  bollinger: '#42a5f5',
  vwap: '#fdd835',
  rsi: '#b388ff',
  macd: '#2962ff',
  signal: '#ff6d00',
  pivot: '#9598a1',
  resistance: '#ef5350',
  support: '#26a69a',
};

export function buildChartLayers(
  settings: IndicatorSettings,
  data: IndicatorQueries,
): ChartLayers {
  const layers: ChartLayers = { overlays: [], levels: [], panes: [] };
  // Only draw what is switched on AND loaded (a disabled query keeps its cache)
  const on = <T>(id: keyof IndicatorSettings, value: T | undefined) =>
    settings[id].enabled ? value : undefined;

  const sma = on('sma', data.sma.data);
  if (sma) {
    layers.overlays.push({
      id: 'sma',
      label: `SMA ${settings.sma.params.period}`,
      color: INDICATOR_COLORS.sma,
      points: sma.points,
    });
  }

  const ema = on('ema', data.ema.data);
  if (ema) {
    layers.overlays.push({
      id: 'ema',
      label: `EMA ${settings.ema.params.period}`,
      color: INDICATOR_COLORS.ema,
      points: ema.points,
    });
  }

  const bb = on('bollinger', data.bollinger.data);
  if (bb) {
    const { period, stdDev } = settings.bollinger.params;
    const label = `BB ${period} ${stdDev}`;
    const color = INDICATOR_COLORS.bollinger;
    layers.overlays.push(
      { id: 'bb-upper', label: `${label} upper`, color, points: bb.upper },
      { id: 'bb-middle', label, color, points: bb.middle, dashed: true },
      { id: 'bb-lower', label: `${label} lower`, color, points: bb.lower },
    );
  }

  const vwap = on('vwap', data.vwap.data);
  if (vwap) {
    layers.overlays.push({
      id: 'vwap',
      label: 'VWAP',
      color: INDICATOR_COLORS.vwap,
      points: vwap.points,
    });
  }

  const pivots = on('pivots', data.pivots.data);
  if (pivots) {
    const { pivot, r1, r2, r3, s1, s2, s3 } = pivots.levels;
    const level = (title: string, price: number, color: string) =>
      layers.levels.push({
        id: `pivot-${title}`,
        title,
        price,
        color,
        dashed: true,
      });
    level('P', pivot, INDICATOR_COLORS.pivot);
    level('R1', r1, INDICATOR_COLORS.resistance);
    level('R2', r2, INDICATOR_COLORS.resistance);
    level('R3', r3, INDICATOR_COLORS.resistance);
    level('S1', s1, INDICATOR_COLORS.support);
    level('S2', s2, INDICATOR_COLORS.support);
    level('S3', s3, INDICATOR_COLORS.support);
  }

  const levels = on('levels', data.levels.data);
  if (levels) {
    levels.resistances.forEach((r, i) =>
      layers.levels.push({
        id: `resistance-${i}`,
        title: `Resistance ×${r.touches}`,
        price: r.price,
        color: INDICATOR_COLORS.resistance,
        dashed: false,
      }),
    );
    levels.supports.forEach((s, i) =>
      layers.levels.push({
        id: `support-${i}`,
        title: `Support ×${s.touches}`,
        price: s.price,
        color: INDICATOR_COLORS.support,
        dashed: false,
      }),
    );
  }

  const rsi = on('rsi', data.rsi.data);
  if (rsi) {
    layers.panes.push({
      id: 'rsi',
      lines: [
        {
          id: 'rsi',
          label: `RSI ${settings.rsi.params.period}`,
          color: INDICATOR_COLORS.rsi,
          points: rsi.points,
        },
      ],
      histograms: [],
      // The classic overbought / oversold thresholds
      guides: [
        { price: 70, color: INDICATOR_COLORS.resistance },
        { price: 30, color: INDICATOR_COLORS.support },
      ],
    });
  }

  const macd = on('macd', data.macd.data);
  if (macd) {
    const { fast, slow, signal } = settings.macd.params;
    layers.panes.push({
      id: 'macd',
      lines: [
        {
          id: 'macd',
          label: `MACD ${fast} ${slow} ${signal}`,
          color: INDICATOR_COLORS.macd,
          points: macd.macd,
        },
        {
          id: 'macd-signal',
          label: 'Signal',
          color: INDICATOR_COLORS.signal,
          points: macd.signal,
        },
      ],
      histograms: [
        {
          id: 'macd-histogram',
          label: 'Histogram',
          points: macd.histogram,
          upColor: 'rgba(38, 166, 154, 0.5)',
          downColor: 'rgba(239, 83, 80, 0.5)',
        },
      ],
      guides: [{ price: 0, color: INDICATOR_COLORS.pivot }],
    });
  }

  return layers;
}
