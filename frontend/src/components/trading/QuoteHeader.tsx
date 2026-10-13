import type { Quote } from '../../services/types';
import { DataSourceBadge } from '../charts/DataSourceBadge';
import { MarketStatusBadge } from './MarketStatusBadge';

type Props = {
  symbol: string;
  name?: string;
  quote?: Quote;
};

const timeFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// Symbol, last price and today's change, above the chart
export function QuoteHeader({ symbol, name, quote }: Props) {
  const color =
    !quote || quote.change === 0
      ? 'text-muted'
      : quote.change > 0
        ? 'text-up'
        : 'text-down';
  const sign = quote && quote.change > 0 ? '+' : '';

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
      <div className="min-w-0">
        <h1 className="text-lg leading-tight font-semibold">{symbol}</h1>
        {name && <p className="truncate text-xs text-muted">{name}</p>}
      </div>

      {quote && (
        <div className="flex items-baseline gap-2 tabular-nums">
          <span className="text-2xl font-semibold">
            {quote.price.toFixed(2)}
          </span>
          <span className={`text-sm ${color}`}>
            {sign}
            {quote.change.toFixed(2)} ({sign}
            {quote.changePercent.toFixed(2)}%)
          </span>
          <span className="text-xs text-muted">USD</span>
        </div>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-3">
        <MarketStatusBadge />
        {quote && (
          <span className="text-xs text-muted">
            as of {timeFormat.format(new Date(quote.timestamp))} ET
          </span>
        )}
        {quote && <DataSourceBadge source={quote.source} />}
      </div>
    </div>
  );
}
