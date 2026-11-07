import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Portfolio, Position } from '../../services/types';
import { AllocationChart } from './AllocationChart';

const position = (
  symbol: string,
  marketValue: string,
  allocationPercent: string,
): Position => ({
  symbol,
  name: `${symbol} Inc.`,
  quantity: 1,
  averagePrice: marketValue,
  currentPrice: marketValue,
  marketValue,
  unrealizedPnL: '0.00',
  unrealizedPnLPercent: '0.00',
  allocationPercent,
});

// Total 100,000: easy percentages
const portfolio = (overrides: Partial<Portfolio> = {}): Portfolio => ({
  cashBalance: '40000.00',
  cashPercent: '40.00',
  positionsValue: '60000.00',
  totalValue: '100000.00',
  unrealizedPnL: '0.00',
  realizedPnL: '0.00',
  // Deliberately not sorted: the chart sorts by value
  positions: [
    position('KO', '3000.00', '3.00'),
    position('AAPL', '25000.00', '25.00'),
    position('INTC', '2000.00', '2.00'),
    position('MSFT', '15000.00', '15.00'),
    position('NVDA', '10000.00', '10.00'),
    position('TSLA', '5000.00', '5.00'),
  ],
  ...overrides,
});

const legend = () =>
  within(screen.getByRole('list'))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

describe('AllocationChart', () => {
  it('shows cash, the 4 biggest stocks, and folds the rest into Other', () => {
    render(<AllocationChart portfolio={portfolio()} />);

    expect(legend()).toEqual([
      'Cash',
      'AAPL',
      'MSFT',
      'NVDA',
      'TSLA',
      'Other (2)',
    ]);
    // Other = KO + INTC: 5,000 and 5% of the whole
    expect(
      screen.getByRole('img', { name: 'Other (2): $5,000.00, 5.00%' }),
    ).toBeInTheDocument();
  });

  it('still lists every holding in the table, largest first', () => {
    render(<AllocationChart portfolio={portfolio()} />);

    const rows = within(screen.getByRole('table')).getAllByRole('row');
    const names = rows
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[0].textContent);
    expect(names).toEqual([
      'Cash',
      'AAPL',
      'MSFT',
      'NVDA',
      'TSLA',
      'KO',
      'INTC',
    ]);
  });

  it('draws nothing for a part worth $0 (no cash left)', () => {
    render(
      <AllocationChart
        portfolio={portfolio({ cashBalance: '0.00', cashPercent: '0.00' })}
      />,
    );

    expect(legend()).not.toContain('Cash');
    expect(screen.queryByRole('img', { name: /^Cash/ })).toBeNull();
  });

  it('has no "Other" with 4 stocks or fewer', () => {
    render(
      <AllocationChart
        portfolio={portfolio({
          positions: [position('AAPL', '60000.00', '60.00')],
        })}
      />,
    );

    expect(legend()).toEqual(['Cash', 'AAPL']);
  });

  it('explains the empty state instead of drawing a one-part bar', () => {
    render(<AllocationChart portfolio={portfolio({ positions: [] })} />);

    expect(screen.getByText(/100% cash/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });
});
