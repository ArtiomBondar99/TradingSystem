import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { OrderFilledEvent } from '../messaging/events/order-filled.event.js';
import { OrderEvents } from '../messaging/messaging.constants.js';
import { RabbitMqService } from '../messaging/rabbitmq.service.js';

export const ORDER_FILLED_NOTIFICATIONS_QUEUE = 'notifications.order-filled';

/**
 * Reacts to filled orders, outside the HTTP request: the user already got
 * their 201 before this runs. Today it only logs; this is where an email or
 * push notification would be sent. It could move to a separate worker
 * process without changing the order code at all.
 */
@Injectable()
export class OrderFilledConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(OrderFilledConsumer.name);

  constructor(private readonly rabbitMq: RabbitMqService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.rabbitMq.consume<OrderFilledEvent>(
      ORDER_FILLED_NOTIFICATIONS_QUEUE,
      OrderEvents.FILLED,
      (event, messageId) => this.handle(event, messageId),
    );
  }

  async handle(
    event: OrderFilledEvent,
    messageId: string | undefined,
  ): Promise<void> {
    // A real sender must be idempotent (at-least-once delivery): e.g. store
    // messageId and skip it if it was already handled
    this.logger.log(
      `Notify user ${event.userId}: ${event.side} ${event.quantity} ${event.symbol} @ ${event.price} filled (event ${messageId})`,
    );
  }
}
