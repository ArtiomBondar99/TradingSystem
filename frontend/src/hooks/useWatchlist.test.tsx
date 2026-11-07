import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../services/watchlist.service';
import type { Stock, WatchlistItem } from '../services/types';
import { createTestQueryClient } from '../test/render';
import { TestProviders } from '../test/TestProviders';
import { useToggleWatchlist } from './useWatchlist';

// No network: every call to the watchlist API is a mock the test controls
vi.mock('../services/watchlist.service');

const aapl: WatchlistItem = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  currentPrice: '342.41',
  change: -2.19,
  changePercent: -0.64,
  addedAt: '2026-11-07T10:00:00.000Z',
};

const nvdaStock: Stock = {
  symbol: 'NVDA',
  name: 'NVIDIA Corporation',
  currentPrice: '187.62',
  updatedAt: '2026-11-07T10:00:00.000Z',
};

// A promise the test resolves or rejects when it wants: lets us look at
// the screen WHILE the request is still in flight
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useToggleWatchlist', () => {
  let client: ReturnType<typeof createTestQueryClient>;

  const renderToggle = () =>
    renderHook(() => useToggleWatchlist(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <TestProviders client={client}>{children}</TestProviders>
      ),
    });
  const watchlist = () => client.getQueryData<WatchlistItem[]>(['watchlist']);

  beforeEach(() => {
    client = createTestQueryClient();
    client.setQueryData(['watchlist'], [aapl]);
    client.setQueryData(['stocks'], [nvdaStock]);
    vi.mocked(api.getWatchlist).mockResolvedValue([aapl]);
  });

  it('shows an added stock at once, before the server answers', async () => {
    const request = deferred();
    vi.mocked(api.addToWatchlist).mockReturnValue(request.promise);
    const { result } = renderToggle();

    act(() => result.current.mutate({ symbol: 'NVDA', watched: false }));

    // Still waiting for the server, but the list already has it, with the
    // name and price from the stocks we had, and no made-up change
    await waitFor(() =>
      expect(watchlist()?.map((item) => item.symbol)).toEqual(['AAPL', 'NVDA']),
    );
    expect(watchlist()?.[1]).toMatchObject({
      name: 'NVIDIA Corporation',
      currentPrice: '187.62',
      change: null,
    });
    expect(api.addToWatchlist).toHaveBeenCalledWith('NVDA');

    await act(async () => request.resolve());
  });

  it('puts the list back when the server refuses', async () => {
    const request = deferred();
    vi.mocked(api.addToWatchlist).mockReturnValue(request.promise);
    const { result } = renderToggle();

    act(() => result.current.mutate({ symbol: 'NVDA', watched: false }));
    await waitFor(() => expect(watchlist()).toHaveLength(2));

    await act(async () => request.reject(new Error('409 watchlist full')));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(watchlist()).toEqual([aapl]);
  });

  it('removes a stock at once', async () => {
    const request = deferred();
    vi.mocked(api.removeFromWatchlist).mockReturnValue(request.promise);
    const { result } = renderToggle();

    act(() => result.current.mutate({ symbol: 'AAPL', watched: true }));

    await waitFor(() => expect(watchlist()).toEqual([]));
    expect(api.removeFromWatchlist).toHaveBeenCalledWith('AAPL');
    expect(api.addToWatchlist).not.toHaveBeenCalled();

    await act(async () => request.resolve());
  });
});
