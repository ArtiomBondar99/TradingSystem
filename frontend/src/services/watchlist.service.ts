import { api } from './api';
import type { WatchlistItem } from './types';

export async function getWatchlist(): Promise<WatchlistItem[]> {
  const { data } = await api.get<WatchlistItem[]>('/watchlist');
  return data;
}

// PUT/DELETE are idempotent on the server: safe to send twice
export async function addToWatchlist(symbol: string): Promise<void> {
  await api.put(`/watchlist/${encodeURIComponent(symbol)}`);
}

export async function removeFromWatchlist(symbol: string): Promise<void> {
  await api.delete(`/watchlist/${encodeURIComponent(symbol)}`);
}
