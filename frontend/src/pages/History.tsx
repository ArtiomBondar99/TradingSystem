import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { Panel } from '../components/ui/Panel';
import { useStocks } from '../hooks/useStocks';
import { useTransactions } from '../hooks/useTransactions';
import { formatMoney, formatSignedMoney, pnlColor } from '../lib/format';
import type { OrderSide, TransactionFilters } from '../services/types';

// New York time, like the chart and the orders list. Date and time are
// separate so phones can stack them on two lines.
const dateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});
const timeFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// Phones keep date, side, symbol, qty and realized P&L; the rest is derived
// (amount = price * qty) or secondary, and appears on wider screens
const FROM_SM = 'hidden sm:table-cell';
const WIDE_ONLY = 'hidden md:table-cell';

const TYPE_OPTIONS: { value: OrderSide | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'BUY', label: 'Buys' },
  { value: 'SELL', label: 'Sells' },
];

// Every executed trade, newest first. The filters live in the URL
// (?type=SELL&symbol=AAPL): the back button and a copied link keep them.
export default function History() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readFilters(searchParams);
  const transactions = useTransactions(filters);
  const stocks = useStocks();

  const rows = transactions.data?.pages.flatMap((page) => page.items) ?? [];
  const filtered = filters.type !== undefined || filters.symbol !== undefined;

  const setFilter = (key: keyof TransactionFilters, value?: string) =>
    setSearchParams(
      (current) => {
        // A copy: never mutate the router's own object
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <h1 className="text-lg font-semibold">Trade history</h1>

      <div className="flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="Trade type"
          className="flex rounded border border-line bg-panel p-0.5 text-sm"
        >
          {TYPE_OPTIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={filters.type === option.value}
              onClick={() => setFilter('type', option.value)}
              className={`rounded px-3 py-1 ${
                filters.type === option.value
                  ? 'bg-panel-hover text-fg'
                  : 'text-muted hover:text-fg'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-muted">
          Stock
          <select
            value={filters.symbol ?? ''}
            onChange={(event) => setFilter('symbol', event.target.value)}
            className="rounded border border-line bg-panel px-2 py-1.5 text-fg"
          >
            <option value="">All stocks</option>
            {stocks.data?.map((stock) => (
              <option key={stock.symbol} value={stock.symbol}>
                {stock.symbol}
              </option>
            ))}
          </select>
        </label>
      </div>

      {transactions.isError && <ErrorMessage error={transactions.error} />}

      <Panel>
        {transactions.isPending ? (
          <p className="p-4 text-sm text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <EmptyState filtered={filtered} />
        ) : (
          <div
            // Dimmed while a new filter loads over the old rows
            className={`overflow-x-auto transition-opacity ${
              transactions.isPlaceholderData ? 'opacity-50' : ''
            }`}
          >
            <table className="w-full text-sm tabular-nums">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  <Th align="left">Date (ET)</Th>
                  <Th align="left">Side</Th>
                  <Th align="left">Symbol</Th>
                  <Th>Qty</Th>
                  <Th className={FROM_SM}>Price</Th>
                  <Th className={WIDE_ONLY}>Amount</Th>
                  <Th className={WIDE_ONLY}>Fee</Th>
                  <Th>Realized P&L</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-line last:border-0 hover:bg-panel-hover"
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-muted sm:px-4">
                      {dateFormat.format(new Date(t.createdAt))}{' '}
                      <span className="block text-xs sm:inline sm:text-sm">
                        {timeFormat.format(new Date(t.createdAt))}
                      </span>
                    </td>
                    <td
                      className={`px-3 py-2 sm:px-4 ${t.type === 'BUY' ? 'text-up' : 'text-down'}`}
                    >
                      {t.type === 'BUY' ? 'Buy' : 'Sell'}
                    </td>
                    <td className="px-3 py-2 sm:px-4">
                      <Link
                        to={`/trading/${t.symbol}`}
                        className="font-medium hover:text-accent"
                      >
                        {t.symbol}
                      </Link>
                    </td>
                    <td className="px-3 py-2 sm:px-4 text-right">
                      {t.quantity}
                    </td>
                    <td className={`px-3 py-2 text-right sm:px-4 ${FROM_SM}`}>
                      {formatMoney(t.price)}
                    </td>
                    <td className={`px-3 py-2 sm:px-4 text-right ${WIDE_ONLY}`}>
                      {formatMoney(t.amount)}
                    </td>
                    <td
                      className={`px-3 py-2 sm:px-4 text-right text-muted ${WIDE_ONLY}`}
                    >
                      {formatMoney(t.fee)}
                    </td>
                    {t.realizedPnL === null ? (
                      // A buy locks in nothing: a dash, not "$0.00"
                      <td className="px-3 py-2 sm:px-4 text-right text-muted">
                        <span aria-label="Not applicable">—</span>
                      </td>
                    ) : (
                      <td
                        className={`px-3 py-2 sm:px-4 text-right ${pnlColor(t.realizedPnL)}`}
                      >
                        {formatSignedMoney(t.realizedPnL)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {transactions.hasNextPage && (
          <div className="border-t border-line p-3 text-center">
            <button
              type="button"
              onClick={() => void transactions.fetchNextPage()}
              disabled={transactions.isFetchingNextPage}
              className="rounded border border-line px-4 py-1.5 text-sm text-muted hover:bg-panel-hover hover:text-fg disabled:opacity-50"
            >
              {transactions.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}

// Only values the API accepts: a hand-edited URL can't send garbage
function readFilters(params: URLSearchParams): TransactionFilters {
  const type = params.get('type');
  const symbol = params.get('symbol');
  return {
    type: type === 'BUY' || type === 'SELL' ? type : undefined,
    symbol: symbol && /^[A-Z]{1,10}$/.test(symbol) ? symbol : undefined,
  };
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="px-4 py-10 text-center text-sm text-muted">
      {filtered ? (
        <p>No trades match these filters.</p>
      ) : (
        <>
          <p>No trades yet.</p>
          <Link
            to="/trading"
            className="mt-2 inline-block text-accent hover:underline"
          >
            Place your first trade
          </Link>
        </>
      )}
    </div>
  );
}

function Th({
  children,
  align = 'right',
  className = '',
}: {
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-2 font-normal whitespace-nowrap sm:px-4 ${align === 'left' ? 'text-left' : 'text-right'} ${className}`}
    >
      {children}
    </th>
  );
}
