import type { DataKind, DataSource } from '../../services/types';

type Props = { source: DataSource };

// Every chart and quote says what kind of data it is. Simulated or delayed
// prices must never look like a live market feed.
const LABELS: Record<DataKind, { text: string; className: string }> = {
  REALTIME: { text: 'Real-time', className: 'border-up/40 text-up' },
  DELAYED: { text: 'Delayed', className: 'border-warn/40 text-warn' },
  HISTORICAL: { text: 'Historical', className: 'border-muted/40 text-muted' },
  SIMULATED: { text: 'Simulated data', className: 'border-warn/40 text-warn' },
};

export function DataSourceBadge({ source }: Props) {
  const label = LABELS[source.kind];

  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${label.className}`}
      title={`${source.provider}: ${source.description}`}
    >
      {label.text}
    </span>
  );
}
