import { api } from './api';
import type {
  CandlesResponse,
  MarketDataSource,
  MarketStatus,
  Quote,
  SymbolSearchResult,
  Timeframe,
} from './types';

// The frontend never talks to a market-data provider directly: the backend
// holds the API keys, caches responses and labels where the data comes from.

export async function getMarketDataSource(): Promise<MarketDataSource> {
  const { data } = await api.get<MarketDataSource>('/market-data/source');
  return data;
}

export async function getMarketStatus(): Promise<MarketStatus> {
  const { data } = await api.get<MarketStatus>('/market-data/status');
  return data;
}

export async function searchSymbols(q: string): Promise<SymbolSearchResult[]> {
  const { data } = await api.get<SymbolSearchResult[]>('/market-data/search', {
    params: { q },
  });
  return data;
}

export async function getCandles(
  symbol: string,
  timeframe: Timeframe,
  limit = 300,
): Promise<CandlesResponse> {
  const { data } = await api.get<CandlesResponse>(
    `/market-data/${symbol}/candles`,
    { params: { timeframe, limit } },
  );
  return data;
}

export async function getQuote(symbol: string): Promise<Quote> {
  const { data } = await api.get<Quote>(`/market-data/${symbol}/quote`);
  return data;
}
