import { jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { OutboxRelayService } from './outbox-relay.service.js';
import { RabbitMqService } from './rabbitmq.service.js';

describe('OutboxRelayService', () => {
  const tx = {
    $queryRaw: jest.fn<(...args: any[]) => Promise<any>>(),
    outboxEvent: { updateMany: jest.fn<(args: any) => Promise<any>>() },
  };
  const prisma = {
    $transaction: jest.fn(async (work: (client: typeof tx) => unknown) =>
      work(tx),
    ),
  };
  const rabbitMq = {
    isConnected: jest.fn<() => boolean>(),
    publish: jest.fn<RabbitMqService['publish']>(),
  };
  let relay: OutboxRelayService;

  const event = (id: string) => ({
    id,
    type: 'order.filled',
    payload: { orderId: `order-${id}` },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    rabbitMq.isConnected.mockReturnValue(true);
    rabbitMq.publish.mockResolvedValue(undefined);
    relay = new OutboxRelayService(
      prisma as unknown as PrismaService,
      rabbitMq as unknown as RabbitMqService,
    );
  });

  it('publishes pending events in order and marks them as published', async () => {
    tx.$queryRaw.mockResolvedValue([event('e1'), event('e2')]);

    const published = await relay.relayBatch();

    expect(published).toBe(2);
    expect(rabbitMq.publish.mock.calls).toEqual([
      ['order.filled', { orderId: 'order-e1' }, 'e1'],
      ['order.filled', { orderId: 'order-e2' }, 'e2'],
    ]);
    expect(tx.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['e1', 'e2'] } },
      data: { publishedAt: expect.any(Date) },
    });
  });

  it('uses the event id as messageId, so consumers can drop duplicates', async () => {
    tx.$queryRaw.mockResolvedValue([event('e1')]);

    await relay.relayBatch();

    expect(rabbitMq.publish).toHaveBeenCalledWith(
      expect.any(String),
      expect.anything(),
      'e1',
    );
  });

  it('stops at the first failure and marks only what was really published', async () => {
    tx.$queryRaw.mockResolvedValue([event('e1'), event('e2'), event('e3')]);
    rabbitMq.publish
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('publish timeout'));

    const published = await relay.relayBatch();

    expect(published).toBe(1);
    // e3 is not even tried: keeping the order matters more than speed
    expect(rabbitMq.publish).toHaveBeenCalledTimes(2);
    expect(tx.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['e1'] } },
      data: { publishedAt: expect.any(Date) },
    });
  });

  it('does nothing while RabbitMQ is down: the events wait in the table', async () => {
    rabbitMq.isConnected.mockReturnValue(false);

    expect(await relay.relayBatch()).toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not touch the table when there is nothing to publish', async () => {
    tx.$queryRaw.mockResolvedValue([]);

    expect(await relay.relayBatch()).toBe(0);
    expect(tx.outboxEvent.updateMany).not.toHaveBeenCalled();
  });

  it('claims rows with FOR UPDATE SKIP LOCKED, so instances never collide', async () => {
    tx.$queryRaw.mockResolvedValue([]);

    await relay.relayBatch();

    const sql = (tx.$queryRaw.mock.calls[0][0] as string[]).join('?');
    expect(sql).toMatch(/WHERE published_at IS NULL/);
    expect(sql).toMatch(/ORDER BY created_at/);
    expect(sql).toMatch(/FOR UPDATE SKIP LOCKED/);
  });
});
