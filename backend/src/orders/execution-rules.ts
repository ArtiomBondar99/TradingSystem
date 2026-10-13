import { OrderSide, OrderType, Prisma } from '../generated/prisma/client.js';

/**
 * The simulated exchange's rules, as pure functions. They make paper fills
 * look like real ones; they never touch a real market.
 *
 * - Commission (like a common US "per share" broker plan): $0.005 per share,
 *   at least $1.00, at most 1% of the trade's value.
 * - Slippage: a market fill is a little worse than the last price (a BUY pays
 *   slippageBps more, a SELL gets slippageBps less), as when a real order
 *   eats into the order book. 1 bp = 0.01%.
 * - A LIMIT fill is never worse than its limit.
 */
export type ExecutionRules = {
  feesEnabled: boolean;
  slippageBps: number;
  // Market orders only while the market is open; limit/stop orders wait for it
  enforceMarketHours: boolean;
};

const D = (value: string | number) => new Prisma.Decimal(value);

const COMMISSION_PER_SHARE = D('0.005');
const MIN_COMMISSION = D('1');
const MAX_COMMISSION_RATE = D('0.01');

export function commission(
  rules: ExecutionRules,
  quantity: number,
  notional: Prisma.Decimal,
): Prisma.Decimal {
  if (!rules.feesEnabled) {
    return D(0);
  }
  const perShare = COMMISSION_PER_SHARE.mul(quantity);
  const capped = Prisma.Decimal.min(
    Prisma.Decimal.max(perShare, MIN_COMMISSION),
    notional.mul(MAX_COMMISSION_RATE),
  );
  // Whole cents, rounded up: the broker never undercharges
  return capped.toDecimalPlaces(2, Prisma.Decimal.ROUND_UP);
}

/** The price a fill gets, from the last market price */
export function fillPrice(
  rules: ExecutionRules,
  side: OrderSide,
  marketPrice: Prisma.Decimal,
  limitPrice: Prisma.Decimal | null,
): Prisma.Decimal {
  const slip = D(rules.slippageBps).div(10_000);

  // Whole cents, rounded against the trader (like the slippage itself)
  let price =
    side === OrderSide.BUY
      ? marketPrice
          .mul(D(1).add(slip))
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_UP)
      : marketPrice
          .mul(D(1).sub(slip))
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);

  if (limitPrice) {
    price =
      side === OrderSide.BUY
        ? Prisma.Decimal.min(price, limitPrice)
        : Prisma.Decimal.max(price, limitPrice);
  }
  return price;
}

/**
 * Can a waiting order execute at this market price?
 * LIMIT: at its limit or better (BUY at or below, SELL at or above).
 * STOP: once the price crosses the stop (BUY at or above, SELL at or below).
 */
export function isTriggered(
  order: {
    side: OrderSide;
    type: OrderType;
    limitPrice: Prisma.Decimal | null;
    stopPrice: Prisma.Decimal | null;
  },
  marketPrice: Prisma.Decimal,
): boolean {
  const buy = order.side === OrderSide.BUY;

  if (order.type === OrderType.LIMIT && order.limitPrice) {
    return buy
      ? marketPrice.lessThanOrEqualTo(order.limitPrice)
      : marketPrice.greaterThanOrEqualTo(order.limitPrice);
  }
  if (order.type === OrderType.STOP && order.stopPrice) {
    return buy
      ? marketPrice.greaterThanOrEqualTo(order.stopPrice)
      : marketPrice.lessThanOrEqualTo(order.stopPrice);
  }
  // A MARKET order is always executable
  return order.type === OrderType.MARKET;
}

/**
 * Cash a waiting BUY order sets aside: its worst-case cost plus commission.
 * A LIMIT can't cost more than its limit; a STOP is estimated at its stop
 * price (if the price gaps above it, the fill is re-checked against the cash).
 */
export function reservedCash(
  rules: ExecutionRules,
  order: {
    type: OrderType;
    quantity: number;
    limitPrice: Prisma.Decimal | null;
    stopPrice: Prisma.Decimal | null;
  },
): Prisma.Decimal {
  const price =
    order.type === OrderType.LIMIT ? order.limitPrice : order.stopPrice;
  if (!price) {
    return D(0);
  }
  const notional = price.mul(order.quantity);
  return notional.add(commission(rules, order.quantity, notional));
}
