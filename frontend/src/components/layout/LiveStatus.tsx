import { useRealtimeStore } from '../../hooks/useRealtimeStore';

const STATES = {
  open: { label: 'Live', dot: 'bg-up animate-pulse', text: 'text-muted' },
  connecting: { label: 'Reconnecting…', dot: 'bg-warn', text: 'text-warn' },
  closed: { label: 'Offline', dot: 'bg-down', text: 'text-down' },
};

// The WebSocket's state, in the top bar: "Live" means prices are pushed
export function LiveStatus() {
  const status = useRealtimeStore((state) => state.status);
  const { label, dot, text } = STATES[status];

  return (
    <span
      className={`flex items-center gap-1.5 text-xs whitespace-nowrap ${text}`}
      title={
        status === 'open'
          ? 'Prices and order fills are pushed over a live connection'
          : 'No live connection: data refreshes every few seconds instead'
      }
    >
      <span className={`size-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
