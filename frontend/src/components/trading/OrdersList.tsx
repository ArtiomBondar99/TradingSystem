import { useState, type ReactNode } from 'react';
import {
  useCancelOrder,
  useOpenOrders,
  useOrderHistory,
} from '../../hooks/useOrders';
import { formatMoney } from '../../lib/format';
import type { Order } from '../../services/types';
import { ErrorMessage } from '../ui/ErrorMessage';

type Tab = 'open' | 'history';

const STATUS_STYLES: Record<Order['status'], string> = {
  PENDING: 'text-accent',
  FILLED: 'text-up',
  REJECTED: 'text-down',
  CANCELLED: 'text-muted',
};

// New York time, like the chart and the quote header
const timeFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// "Open orders" (waiting limit orders, with Cancel) and recent history
export function OrdersList() {
  const [tab, setTab] = useState<Tab>('open');
  const openOrders = useOpenOrders();
  const history = useOrderHistory();
  const cancelOrder = useCancelOrder();

  const query = tab === 'open' ? openOrders : history;
  const orders = query.data?.items ?? [];
  const openCount = openOrders.data?.items.length ?? 0;

  return (
    <section className="flex flex-col">
      <div className="flex gap-1 border-y border-line px-2 py-1 text-xs">
        <TabButton active={tab === 'open'} onClick={() => setTab('open')}>
          Open orders{openCount > 0 && ` (${openCount})`}
        </TabButton>
        <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
          History
        </TabButton>
      </div>

      {cancelOrder.isError && (
        <div className="p-2">
          <ErrorMessage error={cancelOrder.error} />
        </div>
      )}

      {orders.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted">
          {tab === 'open' ? 'No open orders' : 'No orders yet'}
        </p>
      ) : (
        <ul className="max-h-[320px] divide-y divide-line overflow-y-auto text-xs">
          {orders.map((order) => (
            <li key={order.id} className="flex items-center gap-2 px-4 py-2">
              <div className="min-w-0 flex-1">
                <p className="tabular-nums">
                  <span
                    className={order.side === 'BUY' ? 'text-up' : 'text-down'}
                  >
                    {order.side === 'BUY' ? 'Buy' : 'Sell'}
                  </span>{' '}
                  {order.quantity}{' '}
                  <span className="font-medium">{order.symbol}</span>{' '}
                  <span className="text-muted">{describeType(order)}</span>
                </p>
                <p className="text-muted tabular-nums">
                  <span className={STATUS_STYLES[order.status]}>
                    {order.status}
                  </span>
                  {order.price && ` at ${formatMoney(order.price)}`}
                  {order.status === 'FILLED' &&
                    Number(order.fee) > 0 &&
                    ` · fee ${formatMoney(order.fee)}`}{' '}
                  ·{' '}
                  {timeFormat.format(
                    new Date(order.executedAt ?? order.createdAt),
                  )}{' '}
                  ET
                </p>
              </div>

              {order.status === 'PENDING' && (
                <button
                  type="button"
                  disabled={cancelOrder.isPending}
                  onClick={() => cancelOrder.mutate(order.id)}
                  className="rounded border border-line px-2 py-1 text-muted hover:border-down hover:text-down disabled:opacity-40"
                >
                  Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// 'market', 'limit $180.00', 'stop $170.00'
function describeType(order: Order): string {
  if (order.type === 'LIMIT')
    return `limit ${formatMoney(order.limitPrice ?? '0')}`;
  if (order.type === 'STOP')
    return `stop ${formatMoney(order.stopPrice ?? '0')}`;
  return 'market';
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded px-2 py-1 ${active ? 'bg-panel-hover text-fg' : 'text-muted hover:text-fg'}`}
    >
      {children}
    </button>
  );
}
