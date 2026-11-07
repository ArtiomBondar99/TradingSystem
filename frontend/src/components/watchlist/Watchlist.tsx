import { Link, useLocation } from 'react-router';
import { useLiveSymbols } from '../../hooks/useRealtime';
import { useToggleWatchlist, useWatchlist } from '../../hooks/useWatchlist';
import { formatMoney } from '../../lib/format';
import { ErrorMessage } from '../ui/ErrorMessage';

// The stocks the user follows: live price and today's change
export function Watchlist() {
  const watchlist = useWatchlist();
  const toggle = useToggleWatchlist();
  // Keep the query string (?tf=1h), like the market list
  const { search } = useLocation();
  const items = watchlist.data ?? [];
  // Live quotes for these stocks while the list is on screen
  useLiveSymbols(items.map((item) => item.symbol));

  if (watchlist.isError) {
    return (
      <div className="p-4">
        <ErrorMessage error={watchlist.error} />
      </div>
    );
  }

  if (watchlist.isPending) {
    return <p className="p-4 text-sm text-muted">Loading…</p>;
  }

  if (items.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-xs text-muted">
        Star a stock on its trading page to follow it here.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line text-sm">
      {items.map((item) => (
        <li key={item.symbol} className="group flex items-center">
          <Link
            to={{ pathname: `/trading/${item.symbol}`, search }}
            className="flex min-w-0 flex-1 items-center justify-between gap-3 py-2 pl-4 hover:bg-panel-hover"
          >
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="font-medium">{item.symbol}</span>
              <span className="truncate text-xs text-muted">{item.name}</span>
            </span>
            <span className="shrink-0 text-right tabular-nums">
              <span className="block">{formatMoney(item.currentPrice)}</span>
              <ChangePercent value={item.changePercent} />
            </span>
          </Link>
          <button
            type="button"
            aria-label={`Remove ${item.symbol} from watchlist`}
            title="Remove from watchlist"
            onClick={() =>
              toggle.mutate({ symbol: item.symbol, watched: true })
            }
            // Always visible: touch screens have no hover to reveal it
            className="self-stretch px-3 text-muted transition-colors hover:bg-panel-hover hover:text-down focus-visible:text-down"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

function ChangePercent({ value }: { value: number | null }) {
  if (value === null) {
    // No live quote yet: a dash, not a made-up 0.00%
    return <span className="block text-xs text-muted">—</span>;
  }
  const color = value > 0 ? 'text-up' : value < 0 ? 'text-down' : 'text-muted';
  return (
    <span className={`block text-xs ${color}`}>
      {value > 0 ? '+' : ''}
      {value.toFixed(2)}%
    </span>
  );
}
