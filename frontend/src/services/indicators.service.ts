import { api } from './api';
import type {
  BollingerResponse,
  LevelsResponse,
  LineIndicatorResponse,
  MacdResponse,
  PivotsResponse,
  Timeframe,
} from './types';

// The maths runs on the backend (backend/src/indicators), next to its tests.
// Every call sends the chart's timeframe and limit, so the points line up
// with the candles on screen.

type Params = Record<string, number>;

async function getIndicator<T>(
  symbol: string,
  indicator: string,
  timeframe: Timeframe,
  params: Params = {},
): Promise<T> {
  const { data } = await api.get<T>(`/indicators/${symbol}/${indicator}`, {
    params: { timeframe, limit: 300, ...params },
  });
  return data;
}

export const getSma = (symbol: string, tf: Timeframe, period: number) =>
  getIndicator<LineIndicatorResponse>(symbol, 'sma', tf, { period });

export const getEma = (symbol: string, tf: Timeframe, period: number) =>
  getIndicator<LineIndicatorResponse>(symbol, 'ema', tf, { period });

export const getRsi = (symbol: string, tf: Timeframe, period: number) =>
  getIndicator<LineIndicatorResponse>(symbol, 'rsi', tf, { period });

export const getVwap = (symbol: string, tf: Timeframe) =>
  getIndicator<LineIndicatorResponse>(symbol, 'vwap', tf);

export const getMacd = (symbol: string, tf: Timeframe, params: Params) =>
  getIndicator<MacdResponse>(symbol, 'macd', tf, params);

export const getBollinger = (symbol: string, tf: Timeframe, params: Params) =>
  getIndicator<BollingerResponse>(symbol, 'bollinger', tf, params);

export const getPivots = (symbol: string, tf: Timeframe) =>
  getIndicator<PivotsResponse>(symbol, 'pivots', tf);

export const getLevels = (symbol: string, tf: Timeframe, params: Params) =>
  getIndicator<LevelsResponse>(symbol, 'levels', tf, params);
