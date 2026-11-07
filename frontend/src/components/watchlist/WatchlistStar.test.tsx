import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../services/watchlist.service';
import type { WatchlistItem } from '../../services/types';
import { createTestQueryClient, renderWithProviders } from '../../test/render';
import { WatchlistStar } from './WatchlistStar';

vi.mock('../../services/watchlist.service');

const aapl: WatchlistItem = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  currentPrice: '342.41',
  change: null,
  changePercent: null,
  addedAt: '2026-11-07T10:00:00.000Z',
};

describe('WatchlistStar', () => {
  beforeEach(() => {
    vi.mocked(api.addToWatchlist).mockResolvedValue();
    vi.mocked(api.removeFromWatchlist).mockResolvedValue();
  });

  it('is a pressed toggle for a watched stock, and removes it on click', async () => {
    vi.mocked(api.getWatchlist).mockResolvedValue([aapl]);
    renderWithProviders(<WatchlistStar symbol="AAPL" />);

    const star = await screen.findByRole('button', {
      name: 'Remove AAPL from watchlist',
      pressed: true,
    });
    // After the click the server says the list is empty
    vi.mocked(api.getWatchlist).mockResolvedValue([]);
    await userEvent.click(star);

    expect(api.removeFromWatchlist).toHaveBeenCalledWith('AAPL');
    expect(
      await screen.findByRole('button', {
        name: 'Add AAPL to watchlist',
        pressed: false,
      }),
    ).toBeInTheDocument();
  });

  it('adds a stock that is not watched', async () => {
    vi.mocked(api.getWatchlist).mockResolvedValue([]);
    const client = createTestQueryClient();
    renderWithProviders(<WatchlistStar symbol="NVDA" />, { client });
    const star = await screen.findByRole('button', {
      name: 'Add NVDA to watchlist',
    });

    // After the add, the server's list has it (the hook refetches it)
    vi.mocked(api.getWatchlist).mockResolvedValue([
      { ...aapl, symbol: 'NVDA', name: 'NVIDIA Corporation' },
    ]);
    await userEvent.click(star);

    expect(api.addToWatchlist).toHaveBeenCalledWith('NVDA');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Remove NVDA from watchlist' }),
      ).toHaveAttribute('aria-pressed', 'true'),
    );
  });
});
