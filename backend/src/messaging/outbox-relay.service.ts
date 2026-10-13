import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { RabbitMqService } from './rabbitmq.service.js';

const POLL_INTERVAL_MS = 1_000;
const BATCH_SIZE = 50;

type PendingEvent = { id: string; type: string; payload: unknown };

/**
 * Moves events from the outbox_events table to RabbitMQ, every second.
 *
 * FOR UPDATE SKIP LOCKED: if several app instances run this at once, each
 * one grabs different rows instead of waiting for (or double-publishing)
 * the rows another instance is already handling.
 */
@Injectable()
export class OutboxRelayService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(OutboxRelayService.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<unknown>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitMq: RabbitMqService,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => {
      // Skip a tick if the previous batch is still being published
      this.running ??= this.relayBatch()
        .catch((error: Error) =>
          this.logger.error(`Outbox relay failed: ${error.message}`),
        )
        .finally(() => (this.running = undefined));
    }, POLL_INTERVAL_MS);
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
    // Let an in-flight batch finish before the DB and broker connections close
    await this.running;
  }

  /** Publishes one batch; returns how many events were published. */
  async relayBatch(): Promise<number> {
    // Broker down: leave the events in the table, they'll go out on reconnect
    if (!this.rabbitMq.isConnected()) {
      return 0;
    }

    return this.prisma.$transaction(
      async (tx) => {
        const events = await tx.$queryRaw<PendingEvent[]>`
          SELECT id, type, payload FROM outbox_events
          WHERE published_at IS NULL
          ORDER BY created_at
          LIMIT ${BATCH_SIZE}
          FOR UPDATE SKIP LOCKED
        `;

        const published: string[] = [];
        for (const event of events) {
          try {
            await this.rabbitMq.publish(event.type, event.payload, event.id);
            published.push(event.id);
          } catch (error) {
            // Stop here and keep the order; the rest is retried next tick
            this.logger.warn(
              `Could not publish event ${event.id}: ${(error as Error).message}`,
            );
            break;
          }
        }

        if (published.length > 0) {
          await tx.outboxEvent.updateMany({
            where: { id: { in: published } },
            data: { publishedAt: new Date() },
          });
        }

        return published.length;
      },
      // Publishing waits for broker confirms: allow more than the 5s default
      { timeout: 30_000 },
    );
  }
}
