import { useMarketStatus } from '../../hooks/useMarketData';

const SESSION_LABELS = {
  REGULAR: 'Market open',
  PRE_MARKET: 'Pre-market',
  AFTER_HOURS: 'After hours',
  CLOSED: 'Market closed',
};

const nextOpenFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// "● Market open" or "● Market closed · opens Mon 09:30 ET"
export function MarketStatusBadge() {
  const { data: status } = useMarketStatus();
  if (!status) return null;

  return (
    <span className="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted">
      <span
        className={`size-2 rounded-full ${status.isOpen ? 'bg-up' : 'bg-muted'}`}
      />
      {SESSION_LABELS[status.session]}
      {!status.isOpen && (
        <span className="hidden sm:inline">
          · opens {nextOpenFormat.format(new Date(status.nextOpen))} ET
        </span>
      )}
    </span>
  );
}
