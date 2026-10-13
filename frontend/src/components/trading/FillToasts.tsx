import { useEffect } from 'react';
import { useRealtimeStore } from '../../hooks/useRealtimeStore';
import { formatMoney } from '../../lib/format';
import type { OrderFilledEvent } from '../../services/realtime';

const VISIBLE_MS = 6_000;

// Pop-ups for fills pushed over the WebSocket, e.g. a limit order that
// executed while you were looking at another page
export function FillToasts() {
  const fills = useRealtimeStore((state) => state.fills);

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2">
      {fills.map((fill) => (
        <Toast key={fill.orderId} fill={fill} />
      ))}
    </div>
  );
}

function Toast({ fill }: { fill: OrderFilledEvent }) {
  const dismiss = useRealtimeStore((state) => state.dismissFill);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(fill.orderId), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [fill.orderId, dismiss]);

  const buy = fill.side === 'BUY';
  return (
    <div
      role="status"
      className={`pointer-events-auto w-72 rounded-lg border bg-panel px-4 py-3 text-sm shadow-xl ${
        buy ? 'border-up/50' : 'border-down/50'
      }`}
    >
      <p className={`font-semibold ${buy ? 'text-up' : 'text-down'}`}>
        Order filled
      </p>
      <p className="mt-0.5 tabular-nums">
        {buy ? 'Bought' : 'Sold'} {fill.quantity} {fill.symbol} at{' '}
        {formatMoney(fill.price)}
        <span className="text-muted"> · fee {formatMoney(fill.fee)}</span>
      </p>
    </div>
  );
}
