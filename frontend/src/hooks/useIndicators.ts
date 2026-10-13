import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getBollinger,
  getEma,
  getLevels,
  getMacd,
  getPivots,
  getRsi,
  getSma,
  getVwap,
} from '../services/indicators.service';
import type { Timeframe } from '../services/types';
import type {
  IndicatorId,
  IndicatorSetting,
  IndicatorSettings,
} from './useIndicatorSettings';

export const INTRADAY = new Set<Timeframe>([
  '1m',
  '5m',
  '15m',
  '30m',
  '1h',
  '4h',
]);

// One query per indicator, enabled only while it is switched on. The params
// are part of the query key: changing a period fetches (and caches) the new
// values, and the old ones stay cached for a quick switch back.
function useIndicatorQuery<T>(
  id: IndicatorId,
  symbol: string,
  timeframe: Timeframe,
  setting: IndicatorSetting,
  fetch: () => Promise<T>,
  enabled = setting.enabled,
) {
  return useQuery({
    queryKey: ['indicators', id, symbol, timeframe, setting.params],
    queryFn: fetch,
    enabled,
    refetchInterval: INTRADAY.has(timeframe) ? 15_000 : 60_000,
    // While new params load, keep drawing the previous line (no flicker),
    // but never another stock's or timeframe's line: wrong prices, wrong times
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === symbol &&
      previousQuery.queryKey[3] === timeframe
        ? keepPreviousData(previous)
        : undefined,
  });
}

export function useIndicators(
  symbol: string,
  timeframe: Timeframe,
  settings: IndicatorSettings,
) {
  const { sma, ema, bollinger, vwap, pivots, levels, rsi, macd } = settings;

  return {
    sma: useIndicatorQuery('sma', symbol, timeframe, sma, () =>
      getSma(symbol, timeframe, sma.params.period),
    ),
    ema: useIndicatorQuery('ema', symbol, timeframe, ema, () =>
      getEma(symbol, timeframe, ema.params.period),
    ),
    bollinger: useIndicatorQuery(
      'bollinger',
      symbol,
      timeframe,
      bollinger,
      () => getBollinger(symbol, timeframe, bollinger.params),
    ),
    // VWAP restarts every day: the backend refuses it on daily/weekly bars
    vwap: useIndicatorQuery(
      'vwap',
      symbol,
      timeframe,
      vwap,
      () => getVwap(symbol, timeframe),
      vwap.enabled && INTRADAY.has(timeframe),
    ),
    pivots: useIndicatorQuery('pivots', symbol, timeframe, pivots, () =>
      getPivots(symbol, timeframe),
    ),
    levels: useIndicatorQuery('levels', symbol, timeframe, levels, () =>
      getLevels(symbol, timeframe, levels.params),
    ),
    rsi: useIndicatorQuery('rsi', symbol, timeframe, rsi, () =>
      getRsi(symbol, timeframe, rsi.params.period),
    ),
    macd: useIndicatorQuery('macd', symbol, timeframe, macd, () =>
      getMacd(symbol, timeframe, macd.params),
    ),
  };
}

export type IndicatorQueries = ReturnType<typeof useIndicators>;
