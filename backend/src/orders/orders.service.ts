import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { toCursorPage } from '../common/pagination.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  OrderSide,
  OrderStatus,
  OrderType,
  Prisma,
  type Order,
} from '../generated/prisma/client.js';
import type { OrderFilledEvent } from '../messaging/events/order-filled.event.js';
import { OrderEvents } from '../messaging/messaging.constants.js';
import { StocksService } from '../stocks/stocks.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto.js';
import { OrderPageDto, OrderResponseDto } from './dto/order-response.dto.js';
import { OrdersRepository } from './orders.repository.js';

export const INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS';
export const INSUFFICIENT_SHARES = 'INSUFFICIENT_SHARES';

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
  // Execution price: the current market price
  price: Prisma.Decimal;
  // price * quantity: the cash that leaves (BUY) or enters (SELL) the wallet
  amount: Prisma.Decimal;
  // LIMIT orders: the worst price the user accepts
  limitPrice: Prisma.Decimal | null;
  idempotencyKey: string | null;
};

// What the user's open LIMIT orders have already promised: cash for BUYs,
// shares for SELLs. Not available for new orders, or the same $10,000 could
// back two orders and the wallet would go negative when both fill.
type Reserved = { cash: Prisma.Decimal; shares: number };

/**
 * A LIMIT order can execute when the market price is at its limit or better:
 * a BUY at or below it, a SELL at or above it.
 */
export function isMarketable(
  side: OrderSide,
  marketPrice: Prisma.Decimal,
  limitPrice: Prisma.Decimal,
): boolean {
  return side === OrderSide.BUY
    ? marketPrice.lessThanOrEqualTo(limitPrice)
    : marketPrice.greaterThanOrEqualTo(limitPrice);
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stocksService: StocksService,
    private readonly ordersRepository: OrdersRepository,
  ) {}

  // Order history: every order the user placed, FILLED and REJECTED alike
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
    if (dto.type === OrderType.MARKET && dto.limitPrice !== undefined) {
      throw new BadRequestException(
        'limitPrice is only for LIMIT orders: a MARKET order takes the current price',
      );
    }

    // Read outside the transaction on purpose: a market order executes at the
    // price seen when it was placed. Only the wallet needs to be locked.
    const stock = await this.stocksService.getBySymbolOrThrow(dto.symbol);

    const trade: Trade = {
      userId,
      stockId: stock.id,
      symbol: stock.symbol,
      side: dto.side,
      type: dto.type,
      quantity: dto.quantity,
      price: stock.currentPrice,
      // Decimal math, never JS numbers: 0.1 + 0.2 !== 0.3
      amount: stock.currentPrice.mul(dto.quantity),
      // The DTO allows at most 2 decimals, so toFixed(2) is exact
      limitPrice:
        dto.type === OrderType.LIMIT && dto.limitPrice !== undefined
          ? new Prisma.Decimal(dto.limitPrice.toFixed(2))
          : null,
      idempotencyKey: idempotencyKey ?? null,
    };

    const order = await this.prisma
      .$transaction(async (tx) => {
        const wallet = await this.lockWallet(tx, userId);

        // Checked AFTER the lock: a retry sent at the same moment waits for
        // the first request to commit, and then finds its order here
        const previous = await this.findByIdempotencyKey(tx, trade);
        if (previous) {
          return previous;
        }

        // A LIMIT order whose price isn't reached yet waits in the book
        if (
          trade.limitPrice &&
          !isMarketable(trade.side, trade.price, trade.limitPrice)
        ) {
          return this.rest(tx, wallet, trade);
        }

        // MARKET, or a LIMIT the market already satisfies: execute now, at
        // the market price (which is the limit or better)
        return trade.side === OrderSide.BUY
          ? this.buy(tx, wallet, trade)
          : this.sell(tx, wallet, trade);
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

    return OrderResponseDto.fromEntity(order, stock.symbol);
  }

  /**
   * Called by LimitOrderMatcher when the price reached an open LIMIT order.
   * Returns the FILLED (or REJECTED) order, or null when there was nothing to
   * do: already filled/cancelled meanwhile, or the price moved away again.
   */
  async executePendingOrder(orderId: string): Promise<Order | null> {
    const pending = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!pending || pending.status !== OrderStatus.PENDING) {
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
      if (
        !order ||
        order.status !== OrderStatus.PENDING ||
        order.limitPrice === null
      ) {
        return null;
      }

      // The price now, read inside the transaction, not the one the matcher saw
      const price = order.stock.currentPrice;
      if (!isMarketable(order.side, price, order.limitPrice)) {
        return null;
      }

      const trade: Trade = {
        userId: order.userId,
        stockId: order.stockId,
        symbol: order.stock.symbol,
        side: order.side,
        type: order.type,
        quantity: order.quantity,
        price,
        amount: price.mul(order.quantity),
        limitPrice: order.limitPrice,
        idempotencyKey: order.idempotencyKey,
      };

      return order.side === OrderSide.BUY
        ? this.buy(tx, wallet, trade, order.id)
        : this.sell(tx, wallet, trade, order.id);
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

    // Decimals compare with equals(), not ===; both missing also counts as same
    const sameLimit =
      previous.limitPrice && trade.limitPrice
        ? previous.limitPrice.equals(trade.limitPrice)
        : !previous.limitPrice && !trade.limitPrice;
    const sameRequest =
      previous.stockId === trade.stockId &&
      previous.side === trade.side &&
      previous.type === trade.type &&
      previous.quantity === trade.quantity &&
      sameLimit;

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
        type: OrderType.LIMIT,
        ...(excludeOrderId && { id: { not: excludeOrderId } }),
      },
      select: { side: true, stockId: true, quantity: true, limitPrice: true },
    });

    let cash = new Prisma.Decimal(0);
    let shares = 0;
    for (const order of open) {
      if (order.side === OrderSide.BUY && order.limitPrice) {
        cash = cash.add(order.limitPrice.mul(order.quantity));
      } else if (
        order.side === OrderSide.SELL &&
        order.stockId === trade.stockId
      ) {
        shares += order.quantity;
      }
    }

    return { cash, shares };
  }

  // A LIMIT order that can't execute yet: check that the cash/shares exist
  // (and aren't promised to another order), then save it as PENDING. Nothing
  // moves until it fills.
  private async rest(
    tx: Prisma.TransactionClient,
    wallet: LockedWallet,
    trade: Trade,
  ): Promise<Order> {
    const reserved = await this.reserved(tx, trade);

    if (trade.side === OrderSide.BUY) {
      // Worst case: it fills exactly at the limit
      const needed = (trade.limitPrice as Prisma.Decimal).mul(trade.quantity);
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
      data: {
        ...this.orderFields(trade),
        status: OrderStatus.PENDING,
      },
    });
  }

  private async buy(
    tx: Prisma.TransactionClient,
    wallet: LockedWallet,
    trade: Trade,
    existingOrderId?: string,
  ): Promise<Order> {
    const reserved = await this.reserved(tx, trade, existingOrderId);

    if (wallet.cash_balance.sub(reserved.cash).lessThan(trade.amount)) {
      return this.reject(tx, trade, INSUFFICIENT_FUNDS, existingOrderId);
    }

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { cashBalance: { decrement: trade.amount } },
    });

    await this.addToPosition(tx, trade);

    return this.fill(tx, trade, existingOrderId);
  }

  private async sell(
    tx: Prisma.TransactionClient,
    wallet: LockedWallet,
    trade: Trade,
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
      data: { cashBalance: { increment: trade.amount } },
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

    return this.fill(tx, trade, existingOrderId);
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
  ): Promise<void> {
    const { userId, stockId, quantity, price } = trade;

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
  // row. A waiting LIMIT order is updated; anything else is created FILLED.
  private async fill(
    tx: Prisma.TransactionClient,
    trade: Trade,
    existingOrderId?: string,
  ): Promise<Order> {
    const data = {
      price: trade.price,
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
        price: trade.price,
        amount: trade.amount,
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
      price: trade.price.toFixed(2),
      amount: trade.amount.toFixed(2),
      executedAt: (order.executedAt ?? new Date()).toISOString(),
    };
    await tx.outboxEvent.create({
      data: { type: OrderEvents.FILLED, payload: event },
    });

    return order;
  }
}
