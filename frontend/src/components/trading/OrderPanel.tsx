import { useState, type SubmitEvent } from 'react';
import { useOpenOrders, usePlaceOrder } from '../../hooks/useOrders';
import { usePortfolio } from '../../hooks/usePortfolio';
import { formatMoney } from '../../lib/format';
import type { Order, OrderSide, OrderType, Quote } from '../../services/types';
import { ErrorMessage } from '../ui/ErrorMessage';

type Props = {
  symbol: string;
  quote?: Quote;
};

const REJECT_REASONS: Record<string, string> = {
  INSUFFICIENT_FUNDS: 'Not enough buying power',
  INSUFFICIENT_SHARES: 'Not enough shares (open sell orders reserve theirs)',
};

const money = (value: number) => formatMoney(value.toFixed(2));

/**
 * Buy / sell form. It only describes what the user wants; the backend
 * decides the price, checks the cash and shares, and executes. The numbers
 * shown here are estimates for the user, never sent as facts.
 */
export function OrderPanel({ symbol, quote }: Props) {
  const [side, setSide] = useState<OrderSide>('BUY');
  const [type, setType] = useState<OrderType>('MARKET');
  const [quantity, setQuantity] = useState('1');
  const [limitPrice, setLimitPrice] = useState('');
  // One key per intended order. A retry after a network error reuses it, so
  // the server can't execute the same order twice; any change to the form
  // (a different order) or a successful submit gets a new one.
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [result, setResult] = useState<Order | null>(null);

  const portfolio = usePortfolio();
  const openOrders = useOpenOrders();
  const placeOrder = usePlaceOrder();

  // Any edit = a different order: new key, and the old result is cleared
  const edit =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setIdempotencyKey(crypto.randomUUID());
      setResult(null);
    };

  const marketPrice = quote?.price;
  const qty = Number(quantity);
  const limit = Number(limitPrice);
  const validQuantity = Number.isInteger(qty) && qty >= 1;
  const validLimit =
    type === 'MARKET' || (limit > 0 && /^\d+(\.\d{1,2})?$/.test(limitPrice));
  const pricePerShare = type === 'LIMIT' ? limit : (marketPrice ?? 0);

  // Same rule as the backend: open orders reserve cash (BUY) or shares (SELL)
  const open = openOrders.data?.items ?? [];
  const reservedCash = open
    .filter((o) => o.side === 'BUY' && o.limitPrice)
    .reduce((sum, o) => sum + Number(o.limitPrice) * o.quantity, 0);
  const reservedShares = open
    .filter((o) => o.side === 'SELL' && o.symbol === symbol)
    .reduce((sum, o) => sum + o.quantity, 0);
  const buyingPower = Number(portfolio.data?.cashBalance ?? 0) - reservedCash;
  const owned =
    portfolio.data?.positions.find((p) => p.symbol === symbol)?.quantity ?? 0;
  const sellable = owned - reservedShares;

  const maxQuantity =
    side === 'BUY'
      ? pricePerShare > 0
        ? Math.floor(buyingPower / pricePerShare)
        : 0
      : sellable;

  // What will happen with this limit, in words
  let limitHint: string | null = null;
  if (type === 'LIMIT' && validLimit && marketPrice !== undefined) {
    const fillsNow =
      side === 'BUY' ? marketPrice <= limit : marketPrice >= limit;
    limitHint = fillsNow
      ? `Fills now at the market price (${side === 'BUY' ? 'at or below' : 'at or above'} your limit)`
      : `Waits until ${symbol} is ${side === 'BUY' ? 'at or below' : 'at or above'} ${money(limit)}`;
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    placeOrder.mutate(
      {
        order: {
          symbol,
          side,
          type,
          quantity: qty,
          ...(type === 'LIMIT' && { limitPrice: limit }),
        },
        idempotencyKey,
      },
      {
        onSuccess: (order) => {
          setResult(order);
          setIdempotencyKey(crypto.randomUUID());
        },
      },
    );
  }

  const buying = side === 'BUY';
  const accent = buying ? 'bg-up' : 'bg-down';

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

      {/* Market / Limit */}
      <div className="flex gap-1 text-xs">
        {(['MARKET', 'LIMIT'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={type === option}
            onClick={() => {
              edit(setType)(option);
              // Start the limit at the current price, the usual starting point
              if (option === 'LIMIT' && !limitPrice && marketPrice) {
                setLimitPrice(marketPrice.toFixed(2));
              }
            }}
            className={`rounded px-2 py-1 ${
              type === option
                ? 'bg-panel-hover text-fg'
                : 'text-muted hover:text-fg'
            }`}
          >
            {option === 'MARKET' ? 'Market' : 'Limit'}
          </button>
        ))}
      </div>

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

      {type === 'LIMIT' && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">
            Limit price ({buying ? 'highest you pay' : 'lowest you accept'})
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={0.01}
            step={0.01}
            required
            value={limitPrice}
            onChange={(e) => edit(setLimitPrice)(e.target.value)}
            className="rounded border border-line bg-surface px-3 py-2 tabular-nums outline-none focus:border-accent"
          />
          {limitHint && <span className="text-xs text-muted">{limitHint}</span>}
        </label>
      )}

      <dl className="flex flex-col gap-1 border-t border-line pt-3 text-xs tabular-nums">
        <Row
          label="Market price"
          value={marketPrice !== undefined ? money(marketPrice) : '—'}
        />
        <Row
          label={buying ? 'Estimated cost' : 'Estimated proceeds'}
          value={
            validQuantity && pricePerShare > 0
              ? money(qty * pricePerShare)
              : '—'
          }
        />
        {buying ? (
          <Row label="Buying power" value={money(buyingPower)} />
        ) : (
          <Row
            label="Shares you can sell"
            value={`${sellable}${reservedShares > 0 ? ` (${reservedShares} in open orders)` : ''}`}
          />
        )}
      </dl>

      <button
        type="submit"
        disabled={
          !validQuantity || !validLimit || placeOrder.isPending || !quote
        }
        className={`rounded py-2.5 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 ${accent}`}
      >
        {placeOrder.isPending
          ? 'Sending…'
          : `${buying ? 'Buy' : 'Sell'} ${validQuantity ? qty : ''} ${symbol}${
              type === 'LIMIT' && validLimit ? ` · limit ${money(limit)}` : ''
            }`}
      </button>

      {placeOrder.isError && <ErrorMessage error={placeOrder.error} />}
      {result && <OrderResult order={result} />}

      <p className="text-[11px] leading-snug text-muted">
        Paper trading: virtual money, simulated execution at the server's last
        price. No order reaches a real exchange.
      </p>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
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
        {formatMoney(order.price ?? '0')}
      </p>
    );
  }
  if (order.status === 'PENDING') {
    return (
      <p
        role="status"
        className="rounded border border-accent/40 bg-accent/10 px-3 py-2 text-fg"
      >
        Limit order placed: {order.side === 'BUY' ? 'buy' : 'sell'}{' '}
        {order.quantity} {order.symbol} at{' '}
        {formatMoney(order.limitPrice ?? '0')} or{' '}
        {order.side === 'BUY' ? 'lower' : 'higher'}. It waits below in Open
        orders.
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
