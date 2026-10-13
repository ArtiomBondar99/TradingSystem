import { useMarketStatus } from '../../hooks/useMarketData';
import { useNow } from '../../hooks/useNow';
import { useIsLive, useRealtimeStore } from '../../hooks/useRealtimeStore';
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
// While the market is open the simulated price changes every second; no
// update for this long means something is wrong upstream
const STALE_AFTER_MS = 15_000;

export function QuoteHeader({ symbol, name, quote }: Props) {
  const live = useIsLive();
  const lastQuoteAt = useRealtimeStore((state) => state.lastQuoteAt[symbol]);
  const { data: market } = useMarketStatus();
  const now = useNow(5_000);
  // Stale only means something while prices should move: live and open
  const stale =
    live &&
    market?.isOpen === true &&
    lastQuoteAt !== undefined &&
    now - lastQuoteAt > STALE_AFTER_MS;

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
        {stale && (
          <span
            className="rounded border border-warn/40 px-1.5 py-0.5 text-[11px] font-medium text-warn"
            title={`No price update for ${Math.round((now - lastQuoteAt) / 1000)}s`}
          >
            Stale price
          </span>
        )}
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
