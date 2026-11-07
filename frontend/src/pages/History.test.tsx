import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getStocks } from '../services/stocks.service';
import { getTransactions } from '../services/transactions.service';
import type { Transaction } from '../services/types';
import { renderWithProviders } from '../test/render';
import History from './History';

vi.mock('../services/transactions.service');
vi.mock('../services/stocks.service');

const trade = (
  id: string,
  type: 'BUY' | 'SELL',
  realizedPnL: string | null,
): Transaction => ({
  id,
  orderId: `order-${id}`,
  symbol: 'AAPL',
  type,
  quantity: 10,
  price: '211.98',
  amount: '2119.80',
  fee: '1.00',
  realizedPnL,
  createdAt: '2026-10-13T15:43:00.000Z',
});

describe('History page', () => {
  beforeEach(() => {
    vi.mocked(getStocks).mockResolvedValue([]);
  });

  it('shows a sale with its realized P&L and a buy with a dash', async () => {
    vi.mocked(getTransactions).mockResolvedValue({
      items: [trade('t2', 'SELL', '-3.20'), trade('t1', 'BUY', null)],
      nextCursor: null,
    });

    renderWithProviders(<History />, { route: '/history' });

    const rows = await screen.findAllByRole('row');
    // rows[0] is the header
    expect(within(rows[1]).getByText('-$3.20')).toBeInTheDocument();
    // A buy locks in nothing: "—", never a misleading $0.00
    expect(
      within(rows[2]).getByLabelText('Not applicable'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('reads the filters from the URL, ignoring values the API would reject', async () => {
    vi.mocked(getTransactions).mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    renderWithProviders(<History />, {
      route: '/history?type=SELL&symbol=not-a-symbol!',
    });

    await waitFor(() =>
      expect(getTransactions).toHaveBeenCalledWith({
        type: 'SELL',
        symbol: undefined,
        cursor: undefined,
        limit: 25,
      }),
    );
    expect(screen.getByRole('button', { name: 'Sells' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      await screen.findByText('No trades match these filters.'),
    ).toBeInTheDocument();
  });

  it('asks again with the new filter when a type is clicked', async () => {
    vi.mocked(getTransactions).mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    renderWithProviders(<History />, { route: '/history' });
    await screen.findByText('No trades yet.');

    await userEvent.click(screen.getByRole('button', { name: 'Buys' }));

    await waitFor(() =>
      expect(getTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'BUY', cursor: undefined }),
      ),
    );
  });

  it('loads the next page with the cursor and appends it', async () => {
    vi.mocked(getTransactions)
      .mockResolvedValueOnce({
        items: [trade('t3', 'SELL', '5.00')],
        nextCursor: 't3',
      })
      .mockResolvedValueOnce({
        items: [trade('t2', 'BUY', null)],
        nextCursor: null,
      });
    renderWithProviders(<History />, { route: '/history' });

    await userEvent.click(
      await screen.findByRole('button', { name: 'Load more' }),
    );

    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(3));
    expect(getTransactions).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 't3' }),
    );
    // Last page: nothing more to load
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });
});
