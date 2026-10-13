import { Link, useLocation, useParams } from 'react-router';
import { formatMoney } from '../../lib/format';
import type { Stock } from '../../services/types';

type Props = { stocks: Stock[] };

// Tradable stocks with their last price; a row opens the stock's trading page
export function MarketList({ stocks }: Props) {
  const { symbol: activeSymbol } = useParams();
  // Keep the query string (?tf=1h): switching stocks keeps the timeframe
  const { search } = useLocation();

  return (
    <ul className="max-h-[560px] divide-y divide-line overflow-y-auto text-sm">
      {stocks.map((stock) => (
        <li key={stock.symbol}>
          <Link
            to={{ pathname: `/trading/${stock.symbol}`, search }}
            aria-current={stock.symbol === activeSymbol ? 'page' : undefined}
            className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-panel-hover aria-[current=page]:bg-panel-hover"
          >
            {/* min-w-0 lets a long name shrink and end in "…" instead of
                pushing into the price */}
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="font-medium">{stock.symbol}</span>
              <span className="truncate text-xs text-muted">{stock.name}</span>
            </span>
            <span className="shrink-0 tabular-nums">
              {formatMoney(stock.currentPrice)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
