import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import {
  OrderSide,
  OrderStatus,
  Prisma,
  type Order,
} from '../generated/prisma/client.js';
import { StocksService } from '../stocks/stocks.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrderResponseDto } from './dto/order-response.dto.js';

export const INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS';
export const INSUFFICIENT_SHARES = 'INSUFFICIENT_SHARES';

// Shape of the row returned by the raw SELECT ... FOR UPDATE below
type LockedWallet = { id: string; cash_balance: Prisma.Decimal };

// Everything BUY and SELL need to know about one order
type Trade = {
  userId: string;
  stockId: string;
  side: OrderSide;
  quantity: number;
  price: Prisma.Decimal;
  // price * quantity: the cash that leaves (BUY) or enters (SELL) the wallet
  amount: Prisma.Decimal;
  idempotencyKey: string | null;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stocksService: StocksService,
  ) {}

  async placeOrder(
    userId: string,
    dto: CreateOrderDto,
    idempotencyKey?: string,
  ): Promise<OrderResponseDto> {
    // Read outside the transaction on purpose: a market order executes at the
    // price seen when it was placed. Only the wallet needs to be locked.
    const stock = await this.stocksService.getBySymbolOrThrow(dto.symbol);

    const trade: Trade = {
      userId,
      stockId: stock.id,
      side: dto.side,
      quantity: dto.quantity,
      price: stock.currentPrice,
      // Decimal math, never JS numbers: 0.1 + 0.2 !== 0.3
      amount: stock.currentPrice.mul(dto.quantity),
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
      previous.quantity === trade.quantity;

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

  private async buy(
    tx: Prisma.TransactionClient,
    wallet: LockedWallet,
    trade: Trade,
  ): Promise<Order> {
    if (wallet.cash_balance.lessThan(trade.amount)) {
      return this.reject(tx, trade, INSUFFICIENT_FUNDS);
    }

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { cashBalance: { decrement: trade.amount } },
    });

    await this.addToPosition(tx, trade);

    return this.fill(tx, trade);
  }

  private async sell(
    tx: Prisma.TransactionClient,
    wallet: LockedWallet,
    trade: Trade,
  ): Promise<Order> {
    // Safe to read without its own lock: we already hold the wallet lock
    const position = await tx.position.findUnique({
      where: {
        userId_stockId: { userId: trade.userId, stockId: trade.stockId },
      },
    });

    if (!position || position.quantity < trade.quantity) {
      return this.reject(tx, trade, INSUFFICIENT_SHARES);
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

    return this.fill(tx, trade);
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

  // A rejection is a business outcome, not an error: we save the order and
  // return it. Throwing here would roll back and lose the REJECTED record.
  private reject(
    tx: Prisma.TransactionClient,
    trade: Trade,
    reason: string,
  ): Promise<Order> {
    return tx.order.create({
      data: {
        userId: trade.userId,
        stockId: trade.stockId,
        side: trade.side,
        quantity: trade.quantity,
        status: OrderStatus.REJECTED,
        rejectReason: reason,
        idempotencyKey: trade.idempotencyKey,
      },
    });
  }

  // Records a successful execution: the FILLED order plus its audit-trail row
  private async fill(
    tx: Prisma.TransactionClient,
    trade: Trade,
  ): Promise<Order> {
    const order = await tx.order.create({
      data: {
        userId: trade.userId,
        stockId: trade.stockId,
        side: trade.side,
        quantity: trade.quantity,
        price: trade.price,
        status: OrderStatus.FILLED,
        executedAt: new Date(),
        idempotencyKey: trade.idempotencyKey,
      },
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

    return order;
  }
}
