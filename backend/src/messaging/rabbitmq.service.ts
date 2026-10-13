import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, {
  type AmqpConnectionManager,
  type ChannelWrapper,
} from 'amqp-connection-manager';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import {
  DEAD_LETTER_EXCHANGE,
  EVENTS_EXCHANGE,
} from './messaging.constants.js';

// How long to wait for RabbitMQ to confirm it stored a message
const PUBLISH_TIMEOUT_MS = 5_000;

// A refused connection has an empty message; its code says ECONNREFUSED
const errorReason = (error?: Error): string =>
  error?.message || (error as NodeJS.ErrnoException)?.code || 'unknown';

/**
 * The only class that talks to RabbitMQ. amqp-connection-manager reconnects
 * on its own and re-runs every setup (exchanges, queues, consumers) after a
 * reconnect, so a broker restart heals without restarting the app.
 */
@Injectable()
export class RabbitMqService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private readonly connection: AmqpConnectionManager;
  private readonly channel: ChannelWrapper;

  constructor(config: ConfigService) {
    this.connection = amqp.connect([config.getOrThrow<string>('rabbitmq.url')]);
    // Log changes of state, not every reconnect attempt (every 5s)
    let reportedDown = false;
    this.connection.on('connect', () => {
      reportedDown = false;
      this.logger.log('RabbitMQ connected');
    });
    this.connection.on('disconnect', ({ err }) => {
      reportedDown = true;
      this.logger.warn(`RabbitMQ disconnected: ${errorReason(err)}`);
    });
    this.connection.on('connectFailed', ({ err }) => {
      if (!reportedDown) {
        reportedDown = true;
        this.logger.warn(
          `RabbitMQ unavailable, events will wait in the outbox: ${errorReason(err)}`,
        );
      }
    });

    // A confirm channel: publish() resolves only after the broker has stored
    // the message, so "published" really means published
    this.channel = this.connection.createChannel({
      confirm: true,
      publishTimeout: PUBLISH_TIMEOUT_MS,
      setup: async (channel: ConfirmChannel) => {
        await channel.assertExchange(EVENTS_EXCHANGE, 'topic', {
          durable: true,
        });
        await channel.assertExchange(DEAD_LETTER_EXCHANGE, 'topic', {
          durable: true,
        });
      },
    });
    // Without a listener, an 'error' event (e.g. a setup interrupted by a
    // shutdown) is thrown by Node's EventEmitter and crashes the process.
    // The wrapper recovers on its own; we only need to log it.
    this.channel.on('error', (error: Error) =>
      this.logger.warn(`RabbitMQ channel error: ${error.message}`),
    );
  }

  isConnected(): boolean {
    return this.connection.isConnected();
  }

  /**
   * messageId lets consumers spot duplicates: delivery is at-least-once, so
   * the same event may arrive twice (e.g. the relay crashed after publishing
   * but before marking it as published).
   */
  async publish(
    routingKey: string,
    payload: unknown,
    messageId: string,
  ): Promise<void> {
    await this.channel.publish(
      EVENTS_EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      {
        messageId,
        contentType: 'application/json',
        // Survives a broker restart (the queues are durable too)
        persistent: true,
      },
    );
  }

  /**
   * Declares a durable queue bound to routingKey (plus its dead-letter queue)
   * and consumes it. The handler's message is acked when it resolves; if it
   * throws, the message goes to "<queue>.dead" for a human to inspect.
   */
  async consume<T>(
    queue: string,
    routingKey: string,
    handler: (payload: T, messageId: string | undefined) => Promise<void>,
  ): Promise<void> {
    const deadQueue = `${queue}.dead`;

    await this.channel.addSetup(async (channel: ConfirmChannel) => {
      await channel.assertQueue(deadQueue, { durable: true });
      await channel.bindQueue(deadQueue, DEAD_LETTER_EXCHANGE, routingKey);

      await channel.assertQueue(queue, {
        durable: true,
        deadLetterExchange: DEAD_LETTER_EXCHANGE,
      });
      await channel.bindQueue(queue, EVENTS_EXCHANGE, routingKey);
    });

    await this.channel.consume(
      queue,
      (message: ConsumeMessage) => {
        void this.handle(message, handler);
      },
      // At most 10 unacked messages at a time per consumer
      { prefetch: 10 },
    );
  }

  private async handle<T>(
    message: ConsumeMessage,
    handler: (payload: T, messageId: string | undefined) => Promise<void>,
  ): Promise<void> {
    const messageId: string | undefined = message.properties.messageId;

    try {
      const payload = JSON.parse(message.content.toString()) as T;
      await handler(payload, messageId);
      this.channel.ack(message);
    } catch (error) {
      this.logger.error(
        `Failed to handle message ${messageId}, dead-lettering it: ${(error as Error).message}`,
      );
      // requeue=false: don't retry a bad message forever; it goes to .dead
      this.channel.nack(message, false, false);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel.close();
    await this.connection.close();
  }
}
