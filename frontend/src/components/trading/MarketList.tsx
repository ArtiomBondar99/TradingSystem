import { Link } from 'react-router';
import { formatMoney } from '../../lib/format';
import type { Stock } from '../../services/types';

type Props = { stocks: Stock[] };

// Tradable stocks with their last price; a row opens the stock's trading page
export function MarketList({ stocks }: Props) {
  return (
    <ul className="divide-y divide-line text-sm">
      {stocks.map((stock) => (
        <li key={stock.symbol}>
          <Link
            to={`/trading/${stock.symbol}`}
            className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-panel-hover"
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
