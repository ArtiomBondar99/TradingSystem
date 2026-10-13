import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toCursorPage } from '../common/pagination.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  OrderSide,
  OrderStatus,
  OrderType,
  Prisma,
  type Order,
} from '../generated/prisma/client.js';
import { getMarketStatus } from '../market-data/market-calendar.js';
import type { OrderFilledEvent } from '../messaging/events/order-filled.event.js';
import { OrderEvents } from '../messaging/messaging.constants.js';
import { StocksService } from '../stocks/stocks.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto.js';
import { OrderPreviewDto } from './dto/order-preview.dto.js';
import { OrderPageDto, OrderResponseDto } from './dto/order-response.dto.js';
import {
  commission,
  fillPrice,
  isTriggered,
  reservedCash,
  type ExecutionRules,
} from './execution-rules.js';
import { OrdersRepository } from './orders.repository.js';

export const INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS';
export const INSUFFICIENT_SHARES = 'INSUFFICIENT_SHARES';
export const MARKET_CLOSED = 'MARKET_CLOSED';

// Shape of the row returned by the raw SELECT ... FOR UPDATE below
type LockedWallet = { id: string; cash_balance: Prisma.Decimal };

// Everything BUY and SELL need to know about one order
type Trade = {
  userId: string;
  stockId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  // The last market price; the fill price is derived from it (slippage)
  marketPrice: Prisma.Decimal;
  // LIMIT: the worst price accepted. STOP: the trigger price.
  limitPrice: Prisma.Decimal | null;
  stopPrice: Prisma.Decimal | null;
  idempotencyKey: string | null;
};

// What actually happens to the money when a trade fills
type Execution = {
  price: Prisma.Decimal;
  // price * quantity
  amount: Prisma.Decimal;
  fee: Prisma.Decimal;
};

// What the user's open LIMIT/STOP orders have already promised: cash for
// BUYs, shares for SELLs. Not available for new orders, or the same $10,000
// could back two orders and the wallet would go negative when both fill.
type Reserved = { cash: Prisma.Decimal; shares: number };

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stocksService: StocksService,
    private readonly ordersRepository: OrdersRepository,
    private readonly config: ConfigService,
  ) {}

  // Fees, slippage, market hours (see execution-rules.ts)
  private get rules(): ExecutionRules {
    return this.config.getOrThrow<ExecutionRules>('trading');
  }

  /** Can orders execute right now? (Always, if market hours aren't enforced) */
  isMarketOpen(now = new Date()): boolean {
    return !this.rules.enforceMarketHours || getMarketStatus(now).isOpen;
  }

  // Order history: every order the user placed, whatever its status
  // (GET /transactions shows only the executed ones)
  async getMyOrders(
    userId: string,
    query: ListOrdersQueryDto,
  ): Promise<OrderPageDto> {
    // Ask for one extra row: if it exists, there is a next page
    const rows = await this.ordersRepository.findPageByUserId(
      userId,
      query.limit + 1,
      query.cursor,
      query.status,
      query.symbol,
    );

    const page = toCursorPage(rows, query.limit);

    return {
      items: page.items.map((order) =>
        OrderResponseDto.fromEntity(order, order.stock.symbol),
      ),
      nextCursor: page.nextCursor,
    };
  }

  async placeOrder(
    userId: string,
    dto: CreateOrderDto,
    idempotencyKey?: string,
  ): Promise<OrderResponseDto> {
    const trade = await this.toTrade(userId, dto, idempotencyKey);

    const order = await this.prisma
      .$transaction(async (tx) => {
        const wallet = await this.lockWallet(tx, userId);

        // Checked AFTER the lock: a retry sent at the same moment waits for
        // the first request to commit, and then finds its order here
        const previous = await this.findByIdempotencyKey(tx, trade);
        if (previous) {
          return previous;
        }

        const open = this.isMarketOpen();

        if (trade.type === OrderType.MARKET) {
          // A market order means "now": with no market, it can't execute
          return open
            ? this.execute(tx, wallet, trade)
            : this.reject(tx, trade, MARKET_CLOSED);
        }

        // LIMIT/STOP: execute now if the market is open and the price is
        // already there; otherwise wait in the book (also for the next open)
        return open && isTriggered(trade, trade.marketPrice)
          ? this.execute(tx, wallet, trade)
          : this.rest(tx, wallet, trade);
      })
      .catch((error: unknown) => {
        // Safety net: the unique index caught a duplicate key the check above
        // missed. Should never happen while every order takes the wallet lock.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException(
            'A request with this Idempotency-Key is already being processed',
          );
        }
        throw error;
      });

    return OrderResponseDto.fromEntity(order, trade.symbol);
  }

  /**
   * What would happen if this order were sent now: the estimated fill price,
   * commission and total, whether it executes now or waits, and the cash /
   * shares left after the open orders' reservations. Read-only (no lock):
   * an estimate for the order form, so the rules live only here, not in the UI.
   */
  async previewOrder(
    userId: string,
    dto: CreateOrderDto,
  ): Promise<OrderPreviewDto> {
    const trade = await this.toTrade(userId, dto);

    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    const reserved = await this.reserved(this.prisma, trade);
    const owned = await this.sharesOwned(this.prisma, trade);

    const marketOpen = this.isMarketOpen();
    const executesNow =
      marketOpen &&
      (trade.type === OrderType.MARKET ||
        isTriggered(trade, trade.marketPrice));

    // Now: the fill price. Waiting: a LIMIT's worst case is its limit; a STOP
    // is estimated as a market fill at its stop price.
    let price: Prisma.Decimal;
    if (executesNow || trade.type === OrderType.MARKET) {
      price = fillPrice(
        this.rules,
        trade.side,
        trade.marketPrice,
        trade.limitPrice,
      );
    } else if (trade.type === OrderType.LIMIT) {
      price = trade.limitPrice as Prisma.Decimal;
    } else {
      price = fillPrice(
        this.rules,
        trade.side,
        trade.stopPrice as Prisma.Decimal,
        null,
      );
    }
    const amount = price.mul(trade.quantity);
    const fee = commission(this.rules, trade.quantity, amount);
    const buying = trade.side === OrderSide.BUY;
    const total = buying ? amount.add(fee) : amount.sub(fee);

    const buyingPower = wallet.cashBalance.sub(reserved.cash);
    const sellableShares = owned - reserved.shares;

    // The same checks placeOrder makes, in the same order
    let blockedReason: string | null = null;
    if (trade.type === OrderType.MARKET && !marketOpen) {
      blockedReason = MARKET_CLOSED;
    } else if (
      buying &&
      buyingPower.lessThan(
        executesNow ? total : reservedCash(this.rules, trade),
      )
    ) {
      blockedReason = INSUFFICIENT_FUNDS;
    } else if (!buying && sellableShares < trade.quantity) {
      blockedReason = INSUFFICIENT_SHARES;
    }

    return {
      symbol: trade.symbol,
      marketPrice: trade.marketPrice.toFixed(2),
      marketOpen,
      executesNow,
      blockedReason,
      estimatedPrice: price.toFixed(2),
      estimatedAmount: amount.toFixed(2),
      estimatedFee: fee.toFixed(2),
      estimatedTotal: total.toFixed(2),
      buyingPower: buyingPower.toFixed(2),
      sellableShares,
    };
  }

  // The order as the service works with it: validated prices as Decimals,
  // and the stock's current market price
  private async toTrade(
    userId: string,
    dto: CreateOrderDto,
    idempotencyKey?: string,
  ): Promise<Trade> {
    this.checkPrices(dto);

    // Read outside the transaction on purpose: a market order executes at the
    // price seen when it was placed. Only the wallet needs to be locked.
    const stock = await this.stocksService.getBySymbolOrThrow(dto.symbol);

    // The DTO allows at most 2 decimals, so toFixed(2) is exact
    const toDecimal = (value?: number) =>
      value === undefined ? null : new Prisma.Decimal(value.toFixed(2));

    return {
      userId,
      stockId: stock.id,
      symbol: stock.symbol,
      side: dto.side,
      type: dto.type,
      quantity: dto.quantity,
      marketPrice: stock.currentPrice,
      limitPrice: toDecimal(dto.limitPrice),
      stopPrice: toDecimal(dto.stopPrice),
      idempotencyKey: idempotencyKey ?? null,
    };
  }

  /**
   * Called by LimitOrderMatcher when the price reached an open LIMIT/STOP
   * order. Returns the FILLED (or REJECTED) order, or null when there was
   * nothing to do: already filled/cancelled meanwhile, the price moved away
   * again, or the market is closed.
   */
  async executePendingOrder(orderId: string): Promise<Order | null> {
    const pending = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (
      !pending ||
      pending.status !== OrderStatus.PENDING ||
      !this.isMarketOpen()
    ) {
      return null;
    }

    return this.prisma.$transaction(async (tx) => {
      // The same lock as placing and cancelling: none of them can interleave
      const wallet = await this.lockWallet(tx, pending.userId);

      // Re-read under the lock: a cancel, or another API instance's matcher,
      // may have handled this order since the read above
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { stock: true },
      });
      if (!order || order.status !== OrderStatus.PENDING) {
        return null;
      }

      // The price now, read inside the transaction, not the one the matcher saw
      const marketPrice = order.stock.currentPrice;
      if (!isTriggered(order, marketPrice)) {
        return null;
      }

      const trade: Trade = {
        userId: order.userId,
        stockId: order.stockId,
        symbol: order.stock.symbol,
        side: order.side,
        type: order.type,
        quantity: order.quantity,
        marketPrice,
        limitPrice: order.limitPrice,
        stopPrice: order.stopPrice,
        idempotencyKey: order.idempotencyKey,
      };

      return this.execute(tx, wallet, trade, order.id);
    });
  }

  // Only an order that hasn't executed yet can be cancelled
  async cancelOrder(
    userId: string,
    orderId: string,
  ): Promise<OrderResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      // Same lock as a fill: the matcher can't fill it while we cancel it
      await this.lockWallet(tx, userId);

      // Filtered by userId: someone else's order is "not found", not "forbidden",
      // so ids of other users' orders can't be probed
      const order = await tx.order.findFirst({
        where: { id: orderId, userId },
        include: { stock: true },
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      if (order.status !== OrderStatus.PENDING) {
        throw new ConflictException(
          `Only open orders can be cancelled; this one is ${order.status}`,
        );
      }

      const cancelled = await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED },
      });
      return OrderResponseDto.fromEntity(cancelled, order.stock.symbol);
    });
  }

  // Each order type takes exactly its own price field
  private checkPrices(dto: CreateOrderDto): void {
    const has = {
      limit: dto.limitPrice !== undefined,
      stop: dto.stopPrice !== undefined,
    };

    if (dto.type === OrderType.MARKET && (has.limit || has.stop)) {
      throw new BadRequestException(
        'A MARKET order takes the current price: send no limitPrice or stopPrice',
      );
    }
    if (dto.type === OrderType.LIMIT && has.stop) {
      throw new BadRequestException(
        'A LIMIT order takes a limitPrice, not a stopPrice',
      );
    }
    if (dto.type === OrderType.STOP && has.limit) {
      throw new BadRequestException(
        'A STOP order takes a stopPrice, not a limitPrice',
      );
    }
  }

  // Same key = same request: return the saved order, don't trade again.
  // Same key with a different body is a client bug, so we refuse it.
  private async findByIdempotencyKey(
    tx: Prisma.TransactionClient,
    trade: Trade,
  ): Promise<Order | null> {
    if (!trade.idempotencyKey) {
      return null;
    }

    const previous = await tx.order.findUnique({
      where: {
        userId_idempotencyKey: {
          userId: trade.userId,
          idempotencyKey: trade.idempotencyKey,
        },
      },
    });

    if (!previous) {
      return null;
    }

    const sameRequest =
      previous.stockId === trade.stockId &&
      previous.side === trade.side &&
      previous.type === trade.type &&
      previous.quantity === trade.quantity &&
      samePrice(previous.limitPrice, trade.limitPrice) &&
      samePrice(previous.stopPrice, trade.stopPrice);

    if (!sameRequest) {
      throw new UnprocessableEntityException(
        'Idempotency-Key was already used for a different order',
      );
    }

    return previous;
  }

  // Lock the wallet row until COMMIT. Every order of this user (BUY or SELL)
  // waits here, so they run one at a time: no one can spend the same money
  // or sell the same shares twice.
  private async lockWallet(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<LockedWallet> {
    const [wallet] = await tx.$queryRaw<LockedWallet[]>`
      SELECT id, cash_balance FROM wallets
      WHERE user_id = ${userId}::uuid
      FOR UPDATE
    `;

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  // Computed from the open orders themselves (no extra "reserved" column that
  // could drift out of sync). Safe because we hold the wallet lock.
  private async reserved(
    tx: Prisma.TransactionClient,
    trade: Trade,
    // The order being filled: its own reservation is what pays for it
    excludeOrderId?: string,
  ): Promise<Reserved> {
    const open = await tx.order.findMany({
      where: {
        userId: trade.userId,
        status: OrderStatus.PENDING,
        ...(excludeOrderId && { id: { not: excludeOrderId } }),
      },
      select: {
        side: true,
        type: true,
        stockId: true,
        quantity: true,
        limitPrice: true,
        stopPrice: true,
      },
    });

    let cash = new Prisma.Decimal(0);
    let shares = 0;
    for (const order of open) {
      if (order.side === OrderSide.BUY) {
        cash = cash.add(reservedCash(this.rules, order));
      } else if (order.stockId === trade.stockId) {
        shares += order.quantity;
      }
    }

    return { cash, shares };
  }

  // A LIMIT/STOP order that can't execute yet: check that the cash/shares
  // exist (and aren't promised to another order), then save it as PENDING.
  // Nothing moves until it fills.
  private async rest(
    tx: Prisma.TransactionClient,
    wallet: LockedWallet,
    trade: Trade,
  ): Promise<Order> {
    const reserved = await this.reserved(tx, trade);

    if (trade.side === OrderSide.BUY) {
      const needed = reservedCash(this.rules, trade);
      if (wallet.cash_balance.sub(reserved.cash).lessThan(needed)) {
        return this.reject(tx, trade, INSUFFICIENT_FUNDS);
      }
    } else {
      const owned = await this.sharesOwned(tx, trade);
      if (owned - reserved.shares < trade.quantity) {
        return this.reject(tx, trade, INSUFFICIENT_SHARES);
      }
    }

    return tx.order.create({
      data: { ...this.orderFields(trade), status: OrderStatus.PENDING },
    });
  }

  // The fill: price with slippage, commission, then BUY or SELL
  private execute(
    tx: Prisma.TransactionClient,
    wallet: LockedWallet,
    trade: Trade,
    existingOrderId?: string,
  ): Promise<Order> {
    const price = fillPrice(
      this.rules,
      trade.side,
      trade.marketPrice,
      trade.limitPrice,
    );
    // Decimal math, never JS numbers: 0.1 + 0.2 !== 0.3
    const amount = price.mul(trade.quantity);
    const execution: Execution = {
      price,
      amount,
      fee: commission(this.rules, trade.quantity, amount),
    };

    return trade.side === OrderSide.BUY
      ? this.buy(tx, wallet, trade, execution, existingOrderId)
      : this.sell(tx, wallet, trade, execution, existingOrderId);
  }

  private async buy(
    tx: Prisma.TransactionClient,
    wallet: LockedWallet,
    trade: Trade,
    execution: Execution,
    existingOrderId?: string,
  ): Promise<Order> {
    const reserved = await this.reserved(tx, trade, existingOrderId);
    const cost = execution.amount.add(execution.fee);

    if (wallet.cash_balance.sub(reserved.cash).lessThan(cost)) {
      return this.reject(tx, trade, INSUFFICIENT_FUNDS, existingOrderId);
    }

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { cashBalance: { decrement: cost } },
    });

    await this.addToPosition(tx, trade, execution.price);

    return this.fill(tx, trade, execution, existingOrderId);
  }

  private async sell(
    tx: Prisma.TransactionClient,
    wallet: LockedWallet,
    trade: Trade,
    execution: Execution,
    existingOrderId?: string,
  ): Promise<Order> {
    // Safe to read without its own lock: we already hold the wallet lock
    const position = await tx.position.findUnique({
      where: {
        userId_stockId: { userId: trade.userId, stockId: trade.stockId },
      },
    });
    const reserved = await this.reserved(tx, trade, existingOrderId);

    if (!position || position.quantity - reserved.shares < trade.quantity) {
      return this.reject(tx, trade, INSUFFICIENT_SHARES, existingOrderId);
    }

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { cashBalance: { increment: execution.amount.sub(execution.fee) } },
    });

    const remaining = position.quantity - trade.quantity;

    // Selling never changes averagePrice: the shares you keep cost the same.
    // Sold everything? Remove the row, so the portfolio shows only holdings.
    if (remaining === 0) {
      await tx.position.delete({ where: { id: position.id } });
    } else {
      await tx.position.update({
        where: { id: position.id },
        data: { quantity: remaining },
      });
    }

    return this.fill(tx, trade, execution, existingOrderId);
  }

  private async sharesOwned(
    tx: Prisma.TransactionClient,
    trade: Trade,
  ): Promise<number> {
    const position = await tx.position.findUnique({
      where: {
        userId_stockId: { userId: trade.userId, stockId: trade.stockId },
      },
    });
    return position?.quantity ?? 0;
  }

  private async addToPosition(
    tx: Prisma.TransactionClient,
    trade: Trade,
    price: Prisma.Decimal,
  ): Promise<void> {
    const { userId, stockId, quantity } = trade;

    const position = await tx.position.findUnique({
      where: { userId_stockId: { userId, stockId } },
    });

    if (!position) {
      await tx.position.create({
        data: { userId, stockId, quantity, averagePrice: price },
      });
      return;
    }

    // Weighted average: (old shares * old avg + new shares * price) / all shares
    const newQuantity = position.quantity + quantity;
    const averagePrice = position.averagePrice
      .mul(position.quantity)
      .add(price.mul(quantity))
      .div(newQuantity)
      .toDecimalPlaces(4);

    await tx.position.update({
      where: { id: position.id },
      data: { quantity: newQuantity, averagePrice },
    });
  }

  // The columns every new order row starts with
  private orderFields(trade: Trade) {
    return {
      userId: trade.userId,
      stockId: trade.stockId,
      side: trade.side,
      type: trade.type,
      quantity: trade.quantity,
      limitPrice: trade.limitPrice,
      stopPrice: trade.stopPrice,
      idempotencyKey: trade.idempotencyKey,
    };
  }

  // A rejection is a business outcome, not an error: we save the order and
  // return it. Throwing here would roll back and lose the REJECTED record.
  private reject(
    tx: Prisma.TransactionClient,
    trade: Trade,
    reason: string,
    existingOrderId?: string,
  ): Promise<Order> {
    const data = { status: OrderStatus.REJECTED, rejectReason: reason };

    return existingOrderId
      ? tx.order.update({ where: { id: existingOrderId }, data })
      : tx.order.create({ data: { ...this.orderFields(trade), ...data } });
  }

  // Records a successful execution: the FILLED order plus its audit-trail
  // row. A waiting order is updated; anything else is created FILLED.
  private async fill(
    tx: Prisma.TransactionClient,
    trade: Trade,
    execution: Execution,
    existingOrderId?: string,
  ): Promise<Order> {
    const data = {
      price: execution.price,
      fee: execution.fee,
      status: OrderStatus.FILLED,
      executedAt: new Date(),
    };

    const order = existingOrderId
      ? await tx.order.update({ where: { id: existingOrderId }, data })
      : await tx.order.create({
          data: { ...this.orderFields(trade), ...data },
        });

    await tx.transaction.create({
      data: {
        userId: trade.userId,
        orderId: order.id,
        stockId: trade.stockId,
        // OrderSide and TransactionType share the same values: BUY | SELL
        type: trade.side,
        quantity: trade.quantity,
        price: execution.price,
        amount: execution.amount,
        fee: execution.fee,
      },
    });

    // Transactional outbox: saved in the same transaction as the order, so
    // the event exists if and only if the trade happened. OutboxRelay
    // publishes it to RabbitMQ after COMMIT.
    const event: OrderFilledEvent = {
      orderId: order.id,
      userId: trade.userId,
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity,
      price: execution.price.toFixed(2),
      amount: execution.amount.toFixed(2),
      fee: execution.fee.toFixed(2),
      executedAt: (order.executedAt ?? new Date()).toISOString(),
    };
    await tx.outboxEvent.create({
      data: { type: OrderEvents.FILLED, payload: event },
    });

    return order;
  }
}

// Decimals compare with equals(), not ===; both missing also counts as same
function samePrice(
  a: Prisma.Decimal | null | undefined,
  b: Prisma.Decimal | null | undefined,
): boolean {
  return a && b ? a.equals(b) : !a && !b;
}
