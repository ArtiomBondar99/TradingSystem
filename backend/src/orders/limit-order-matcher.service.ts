import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service.js';
import { OrdersService } from './orders.service.js';

const BATCH_SIZE = 100;

/**
 * The simulated exchange's matching engine for LIMIT orders. Every few
 * seconds it finds the open orders whose limit the current price has reached
 * (a BUY at or below its limit, a SELL at or above it) and executes them,
 * oldest first (time priority, like a real order book).
 *
 * It only picks candidates; OrdersService re-checks everything under the
 * wallet lock before filling, so running it on several API instances at once
 * is safe: the second instance finds the order already FILLED and skips it.
 */
@Injectable()
export class LimitOrderMatcher
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(LimitOrderMatcher.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<unknown>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    const intervalMs = this.config.getOrThrow<number>('orders.matchIntervalMs');
    // 0 = off (the default in tests, which call matchOnce() themselves)
    if (intervalMs <= 0) {
      return;
    }
    this.timer = setInterval(() => {
      // Skip a tick if the previous round is still running
      this.running ??= this.matchOnce()
        .catch((error: Error) =>
          this.logger.error(`Limit order matching failed: ${error.message}`),
        )
        .finally(() => (this.running = undefined));
    }, intervalMs);
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
    await this.running;
  }

  /** One matching round; returns how many orders were filled */
  async matchOnce(): Promise<number> {
    // Served by the (status, stock_id) index: only the open orders are read
    const candidates = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT o.id
      FROM orders o
      JOIN stocks s ON s.id = o.stock_id
      WHERE o.status = 'PENDING'
        AND o.type = 'LIMIT'
        AND (
          (o.side = 'BUY' AND s.current_price <= o.limit_price) OR
          (o.side = 'SELL' AND s.current_price >= o.limit_price)
        )
      ORDER BY o.created_at
      LIMIT ${BATCH_SIZE}
    `;

    let filled = 0;
    for (const { id } of candidates) {
      try {
        const order = await this.ordersService.executePendingOrder(id);
        if (order?.status === 'FILLED') {
          filled++;
        }
      } catch (error) {
        // One bad order must not stop the others
        this.logger.warn(
          `Could not execute order ${id}: ${(error as Error).message}`,
        );
      }
    }

    return filled;
  }
}
