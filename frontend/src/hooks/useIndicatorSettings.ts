import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Which indicators are on, and their parameters. Purely a client-side
// preference, so it lives in Zustand (saved to localStorage), not on the server.

export type IndicatorId =
  | 'volume'
  | 'sma'
  | 'ema'
  | 'bollinger'
  | 'vwap'
  | 'pivots'
  | 'levels'
  | 'rsi'
  | 'macd';

type ParamDefinition = {
  label: string;
  min: number;
  max: number;
  step: number;
};

type IndicatorDefinition = {
  label: string;
  description: string;
  // Drawn on the price chart, or in its own pane below it
  placement: 'overlay' | 'pane';
  intradayOnly?: boolean;
  params: Record<string, ParamDefinition>;
};

// Same limits as the backend DTOs, so the inputs can't send a value it rejects
export const INDICATORS: Record<IndicatorId, IndicatorDefinition> = {
  volume: {
    label: 'Volume',
    description: 'Shares traded per bar',
    placement: 'overlay',
    params: {},
  },
  sma: {
    label: 'SMA',
    description: 'Simple moving average',
    placement: 'overlay',
    params: { period: { label: 'Period', min: 2, max: 200, step: 1 } },
  },
  ema: {
    label: 'EMA',
    description: 'Exponential moving average',
    placement: 'overlay',
    params: { period: { label: 'Period', min: 2, max: 200, step: 1 } },
  },
  bollinger: {
    label: 'Bollinger Bands',
    description: 'SMA ± standard deviations',
    placement: 'overlay',
    params: {
      period: { label: 'Period', min: 2, max: 200, step: 1 },
      stdDev: { label: 'Std dev', min: 0.5, max: 5, step: 0.5 },
    },
  },
  vwap: {
    label: 'VWAP',
    description: 'Volume weighted average price, per day',
    placement: 'overlay',
    intradayOnly: true,
    params: {},
  },
  pivots: {
    label: 'Pivot Points',
    description: 'From the previous day / week / month',
    placement: 'overlay',
    params: {},
  },
  levels: {
    label: 'Support / Resistance',
    description: 'From swing highs and lows',
    placement: 'overlay',
    params: {
      window: { label: 'Swing bars', min: 2, max: 20, step: 1 },
      maxLevels: { label: 'Levels', min: 1, max: 10, step: 1 },
    },
  },
  rsi: {
    label: 'RSI',
    description: 'Relative strength index, 0-100',
    placement: 'pane',
    params: { period: { label: 'Period', min: 2, max: 100, step: 1 } },
  },
  macd: {
    label: 'MACD',
    description: 'Moving average convergence/divergence',
    placement: 'pane',
    params: {
      fast: { label: 'Fast', min: 2, max: 100, step: 1 },
      slow: { label: 'Slow', min: 3, max: 200, step: 1 },
      signal: { label: 'Signal', min: 2, max: 100, step: 1 },
    },
  },
};

export type IndicatorSetting = {
  enabled: boolean;
  params: Record<string, number>;
};
export type IndicatorSettings = Record<IndicatorId, IndicatorSetting>;

const DEFAULTS: IndicatorSettings = {
  volume: { enabled: true, params: {} },
  sma: { enabled: false, params: { period: 20 } },
  ema: { enabled: false, params: { period: 50 } },
  bollinger: { enabled: false, params: { period: 20, stdDev: 2 } },
  vwap: { enabled: false, params: {} },
  pivots: { enabled: false, params: {} },
  levels: { enabled: false, params: { window: 5, maxLevels: 3 } },
  rsi: { enabled: false, params: { period: 14 } },
  macd: { enabled: false, params: { fast: 12, slow: 26, signal: 9 } },
};

type IndicatorStore = {
  settings: IndicatorSettings;
  toggle: (id: IndicatorId) => void;
  setParam: (id: IndicatorId, param: string, value: number) => void;
  reset: () => void;
};

export const useIndicatorSettings = create<IndicatorStore>()(
  persist(
    (set) => ({
      settings: DEFAULTS,
      toggle: (id) =>
        set((state) => ({
          settings: {
            ...state.settings,
            [id]: {
              ...state.settings[id],
              enabled: !state.settings[id].enabled,
            },
          },
        })),
      setParam: (id, param, value) =>
        set((state) => ({
          settings: {
            ...state.settings,
            [id]: {
              ...state.settings[id],
              params: { ...state.settings[id].params, [param]: value },
            },
          },
        })),
      reset: () => set({ settings: DEFAULTS }),
    }),
    { name: 'paper-trading-indicators', version: 1 },
  ),
);
