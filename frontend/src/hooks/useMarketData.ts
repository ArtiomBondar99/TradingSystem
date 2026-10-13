import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getCandles,
  getMarketDataSource,
  getMarketStatus,
  getQuote,
  searchSymbols,
} from '../services/marketData.service';
import type { Timeframe } from '../services/types';

// Polling for now; a WebSocket push replaces it in step 3.4. Slow timeframes
// change slowly, so they are refreshed less often (fewer backend requests).
const CANDLES_REFRESH_MS: Record<Timeframe, number> = {
  '1m': 5_000,
  '5m': 10_000,
  '15m': 15_000,
  '30m': 30_000,
  '1h': 30_000,
  '4h': 60_000,
  '1D': 60_000,
  '1W': 300_000,
};

export function useMarketDataSource() {
  return useQuery({
    queryKey: ['market-data', 'source'],
    queryFn: getMarketDataSource,
    // Which provider is configured doesn't change while the app runs
    staleTime: Infinity,
  });
}

export function useMarketStatus() {
  return useQuery({
    queryKey: ['market-data', 'status'],
    queryFn: getMarketStatus,
    refetchInterval: 60_000,
  });
}

export function useCandles(symbol: string, timeframe: Timeframe) {
  return useQuery({
    queryKey: ['market-data', 'candles', symbol, timeframe],
    queryFn: () => getCandles(symbol, timeframe),
    refetchInterval: CANDLES_REFRESH_MS[timeframe],
  });
}

export function useQuote(symbol: string) {
  return useQuery({
    queryKey: ['market-data', 'quote', symbol],
    queryFn: () => getQuote(symbol),
    refetchInterval: 5_000,
  });
}

export function useSymbolSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['market-data', 'search', q],
    queryFn: () => searchSymbols(q),
    enabled: q.length > 0,
    // Keep showing the last results while the next ones load (no flicker)
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}
