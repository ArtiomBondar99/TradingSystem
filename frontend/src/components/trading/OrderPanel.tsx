import { useMemo, useState, type SubmitEvent } from 'react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useMarketStatus } from '../../hooks/useMarketData';
import { useOrderPreview, usePlaceOrder } from '../../hooks/useOrders';
import { useRealtimeStore } from '../../hooks/useRealtimeStore';
import { formatMoney } from '../../lib/format';
import type {
  Order,
  OrderSide,
  OrderType,
  PlaceOrderRequest,
  Quote,
} from '../../services/types';
import { ErrorMessage } from '../ui/ErrorMessage';

type Props = {
  symbol: string;
  quote?: Quote;
};

const REJECT_REASONS: Record<string, string> = {
  INSUFFICIENT_FUNDS: 'Not enough buying power',
  INSUFFICIENT_SHARES: 'Not enough shares (open sell orders reserve theirs)',
  MARKET_CLOSED:
    'The market is closed: market orders execute only while it is open',
};

const TYPES: { value: OrderType; label: string }[] = [
  { value: 'MARKET', label: 'Market' },
  { value: 'LIMIT', label: 'Limit' },
  { value: 'STOP', label: 'Stop' },
];

const nextOpenFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * Buy / sell form. It only describes what the user wants. The backend
 * decides the price, applies fees and slippage, checks the cash and shares,
 * and executes. Every number shown here comes from the server's preview
 * (POST /orders/preview), so the trading rules exist in one place only.
 */
export function OrderPanel({ symbol, quote }: Props) {
  const [side, setSide] = useState<OrderSide>('BUY');
  const [type, setType] = useState<OrderType>('MARKET');
  const [quantity, setQuantity] = useState('1');
  // The limit price for LIMIT, the stop price for STOP
  const [price, setPrice] = useState('');
  // One key per intended order. A retry after a network error reuses it, so
  // the server can't execute the same order twice; any change to the form
  // (a different order) or a successful submit gets a new one.
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [result, setResult] = useState<Order | null>(null);

  const marketStatus = useMarketStatus();
  const placeOrder = usePlaceOrder();

  // Any edit = a different order: new key, and the old result is cleared
  const edit =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setIdempotencyKey(crypto.randomUUID());
      setResult(null);
    };

  const qty = Number(quantity);
  const priceValue = Number(price);
  const validQuantity = Number.isInteger(qty) && qty >= 1;
  const validPrice =
    type === 'MARKET' || (priceValue > 0 && /^\d+(\.\d{1,2})?$/.test(price));

  // The order as it would be sent; null while the form is incomplete
  const order: PlaceOrderRequest | null =
    validQuantity && validPrice
      ? {
          symbol,
          side,
          type,
          quantity: qty,
          ...(type === 'LIMIT' && { limitPrice: priceValue }),
          ...(type === 'STOP' && { stopPrice: priceValue }),
        }
      : null;

  // Debounce a string, not the object: a new object every render would
  // restart the timer forever. The string only changes with the content.
  const orderKey = order && JSON.stringify(order);
  const debouncedKey = useDebouncedValue(orderKey, 300);
  const previewInput = useMemo(
    () =>
      debouncedKey ? (JSON.parse(debouncedKey) as PlaceOrderRequest) : null,
    [debouncedKey],
  );
  const preview = useOrderPreview(previewInput);
  // The estimate describes exactly what's in the form (not a moment ago)
  const upToDate = preview.data !== undefined && debouncedKey === orderKey;
  const estimate = upToDate ? preview.data : undefined;

  const buying = side === 'BUY';
  const marketClosed = marketStatus.data?.isOpen === false;

  // Most shares the buying power (or the position) allows
  let maxQuantity = 0;
  if (preview.data) {
    if (buying) {
      const perShare = Number(preview.data.estimatedPrice);
      const room =
        Number(preview.data.buyingPower) - Number(preview.data.estimatedFee);
      maxQuantity = perShare > 0 ? Math.max(Math.floor(room / perShare), 0) : 0;
    } else {
      maxQuantity = preview.data.sellableShares;
    }
  }

  function switchType(next: OrderType) {
    edit(setType)(next);
    // Start the price field at the current price, the usual starting point
    if (next !== 'MARKET' && !price && quote) {
      setPrice(quote.price.toFixed(2));
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order) return;
    placeOrder.mutate(
      { order, idempotencyKey },
      {
        onSuccess: (placed) => {
          setResult(placed);
          // Shown right here: no "order filled" pop-up for it as well
          if (placed.status === 'FILLED') {
            useRealtimeStore.getState().markFillSeen(placed.id);
          }
          setIdempotencyKey(crypto.randomUUID());
        },
      },
    );
  }

  const priceLabel =
    type === 'LIMIT'
      ? `Limit price (${buying ? 'highest you pay' : 'lowest you accept'})`
      : `Stop price (${buying ? 'buy when it rises to' : 'sell if it falls to'})`;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4 text-sm">
      {/* Buy / Sell */}
      <div className="grid grid-cols-2 gap-1 rounded bg-surface p-1">
        {(['BUY', 'SELL'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={side === option}
            onClick={() => edit(setSide)(option)}
            className={`rounded py-1.5 font-medium transition-colors ${
              side === option
                ? `${option === 'BUY' ? 'bg-up' : 'bg-down'} text-white`
                : 'text-muted hover:text-fg'
            }`}
          >
            {option === 'BUY' ? 'Buy' : 'Sell'}
          </button>
        ))}
      </div>

      {/* Market / Limit / Stop */}
      <div className="flex gap-1 text-xs">
        {TYPES.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={type === option.value}
            onClick={() => switchType(option.value)}
            className={`rounded px-2 py-1 ${
              type === option.value
                ? 'bg-panel-hover text-fg'
                : 'text-muted hover:text-fg'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {marketClosed && marketStatus.data && (
        <p className="rounded border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
          Market closed until{' '}
          {nextOpenFormat.format(new Date(marketStatus.data.nextOpen))} ET.{' '}
          {type === 'MARKET'
            ? 'Market orders are rejected now; a limit or stop order can wait for the open.'
            : 'This order will wait for the open.'}
        </p>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">Quantity (shares)</span>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            value={quantity}
            onChange={(e) => edit(setQuantity)(e.target.value)}
            className="w-full rounded border border-line bg-surface px-3 py-2 tabular-nums outline-none focus:border-accent"
          />
          <button
            type="button"
            disabled={maxQuantity < 1}
            onClick={() => edit(setQuantity)(String(maxQuantity))}
            className="rounded border border-line px-2 text-xs text-muted hover:text-fg disabled:opacity-40"
          >
            Max
          </button>
        </div>
      </label>

      {type !== 'MARKET' && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">{priceLabel}</span>
          <input
            type="number"
            inputMode="decimal"
            min={0.01}
            step={0.01}
            required
            value={price}
            onChange={(e) => edit(setPrice)(e.target.value)}
            className="rounded border border-line bg-surface px-3 py-2 tabular-nums outline-none focus:border-accent"
          />
        </label>
      )}

      {estimate && order && (
        <p className="text-xs text-muted">
          {describe(order, estimate.executesNow, estimate.marketOpen)}
        </p>
      )}

      <dl
        className={`flex flex-col gap-1 border-t border-line pt-3 text-xs tabular-nums transition-opacity ${
          upToDate ? '' : 'opacity-50'
        }`}
      >
        <Row
          label="Market price"
          value={quote ? formatMoney(quote.price.toFixed(2)) : '—'}
        />
        <Row
          label={
            estimate?.executesNow
              ? 'Est. fill price (incl. slippage)'
              : 'Est. fill price'
          }
          value={estimate ? formatMoney(estimate.estimatedPrice) : '—'}
        />
        <Row
          label="Commission"
          value={estimate ? formatMoney(estimate.estimatedFee) : '—'}
        />
        <Row
          label={buying ? 'Est. total cost' : 'Est. total proceeds'}
          value={estimate ? formatMoney(estimate.estimatedTotal) : '—'}
          strong
        />
        {buying ? (
          <Row
            label="Buying power"
            value={preview.data ? formatMoney(preview.data.buyingPower) : '—'}
          />
        ) : (
          <Row
            label="Shares you can sell"
            value={preview.data ? String(preview.data.sellableShares) : '—'}
          />
        )}
      </dl>

      {estimate?.blockedReason && (
        <p className="text-xs text-down">
          {REJECT_REASONS[estimate.blockedReason] ?? estimate.blockedReason}
        </p>
      )}

      <button
        type="submit"
        disabled={
          !order || placeOrder.isPending || Boolean(estimate?.blockedReason)
        }
        className={`rounded py-2.5 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 ${
          buying ? 'bg-up' : 'bg-down'
        }`}
      >
        {placeOrder.isPending
          ? 'Sending…'
          : `${buying ? 'Buy' : 'Sell'} ${validQuantity ? qty : ''} ${symbol}${
              type !== 'MARKET' && validPrice
                ? ` · ${type.toLowerCase()} ${formatMoney(priceValue.toFixed(2))}`
                : ''
            }`}
      </button>

      {placeOrder.isError && <ErrorMessage error={placeOrder.error} />}
      {result && <OrderResult order={result} />}

      <p className="text-[11px] leading-snug text-muted">
        Paper trading: virtual money, simulated execution with slippage and a
        commission of $0.005/share (min $1). No order reaches a real exchange.
      </p>
    </form>
  );
}

// What will happen, in words
function describe(
  order: PlaceOrderRequest,
  executesNow: boolean,
  marketOpen: boolean,
): string {
  if (executesNow) {
    return 'Executes now at the market price.';
  }
  if (!marketOpen) {
    return order.type === 'MARKET'
      ? 'Would be rejected: the market is closed.'
      : 'Waits for the market to open.';
  }
  const at = formatMoney((order.limitPrice ?? order.stopPrice ?? 0).toFixed(2));
  if (order.type === 'LIMIT') {
    return `Waits until ${order.symbol} is at or ${order.side === 'BUY' ? 'below' : 'above'} ${at}.`;
  }
  return `Becomes a market order when ${order.symbol} ${order.side === 'BUY' ? 'rises' : 'falls'} to ${at}.`;
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className={strong ? 'font-semibold' : ''}>{value}</dd>
    </div>
  );
}

// What the server did with the order
function OrderResult({ order }: { order: Order }) {
  const verb = order.side === 'BUY' ? 'Bought' : 'Sold';

  if (order.status === 'FILLED') {
    return (
      <p
        role="status"
        className="rounded border border-up/40 bg-up/10 px-3 py-2 text-up"
      >
        {verb} {order.quantity} {order.symbol} at{' '}
        {formatMoney(order.price ?? '0')} · fee {formatMoney(order.fee)}
      </p>
    );
  }
  if (order.status === 'PENDING') {
    const word = order.side === 'BUY' ? 'buy' : 'sell';
    return (
      <p
        role="status"
        className="rounded border border-accent/40 bg-accent/10 px-3 py-2 text-fg"
      >
        {order.type === 'STOP'
          ? `Stop order placed: ${word} ${order.quantity} ${order.symbol} at market when it reaches ${formatMoney(order.stopPrice ?? '0')}.`
          : `Limit order placed: ${word} ${order.quantity} ${order.symbol} at ${formatMoney(order.limitPrice ?? '0')} or ${order.side === 'BUY' ? 'lower' : 'higher'}.`}{' '}
        It waits below in Open orders.
      </p>
    );
  }
  return (
    <p
      role="status"
      className="rounded border border-down/40 bg-down/10 px-3 py-2 text-down"
    >
      Rejected: {REJECT_REASONS[order.rejectReason ?? ''] ?? order.rejectReason}
    </p>
  );
}
