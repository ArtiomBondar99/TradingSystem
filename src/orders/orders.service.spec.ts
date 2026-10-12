import { jest } from '@jest/globals';
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma, type Stock } from '../generated/prisma/client.js';
import { StocksService } from '../stocks/stocks.service.js';
import {
  INSUFFICIENT_FUNDS,
  INSUFFICIENT_SHARES,
  OrdersService,
} from './orders.service.js';

const D = (value: string | number) => new Prisma.Decimal(value);

// Unit tests: the database is replaced by mocks, so these check the business
// rules (what gets written, with which numbers). The real locking under
// concurrency is proven in test/orders.e2e-spec.ts.
describe('OrdersService', () => {
  let service: OrdersService;

  const apple: Stock = {
    id: 'stock-aapl',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    currentPrice: D('190'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Everything the service does inside prisma.$transaction(tx => ...)
  const tx = {
    $queryRaw: jest.fn<(...args: any[]) => Promise<any>>(),
    order: {
      findUnique: jest.fn<(args: any) => Promise<any>>(),
      // Echo back what was written, like the database would
      create: jest.fn(async ({ data }: any) => ({
        id: 'order-1',
        type: 'MARKET',
        price: null,
        rejectReason: null,
        executedAt: null,
        idempotencyKey: null,
        createdAt: new Date(),
        ...data,
      })),
    },
    wallet: { update: jest.fn<(args: any) => Promise<any>>() },
    position: {
      findUnique: jest.fn<(args: any) => Promise<any>>(),
      create: jest.fn<(args: any) => Promise<any>>(),
      update: jest.fn<(args: any) => Promise<any>>(),
      delete: jest.fn<(args: any) => Promise<any>>(),
    },
    transaction: { create: jest.fn<(args: any) => Promise<any>>() },
    outboxEvent: { create: jest.fn<(args: any) => Promise<any>>() },
  };
  const prisma = {
    $transaction: jest.fn(async (work: (client: typeof tx) => unknown) =>
      work(tx),
    ),
  };
  const stocksService = {
    getBySymbolOrThrow: jest.fn<StocksService['getBySymbolOrThrow']>(),
  };

  const givenCash = (cash: string) =>
    tx.$queryRaw.mockResolvedValue([{ id: 'wallet-1', cash_balance: D(cash) }]);

  const givenPosition = (quantity: number, averagePrice: string) =>
    tx.position.findUnique.mockResolvedValue({
      id: 'position-1',
      quantity,
      averagePrice: D(averagePrice),
    });

  // The first argument of the first call to a mock
  const firstArg = (mock: jest.Mock<any>) => mock.mock.calls[0][0] as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    stocksService.getBySymbolOrThrow.mockResolvedValue(apple);
    tx.order.findUnique.mockResolvedValue(null);
    tx.position.findUnique.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: StocksService, useValue: stocksService },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  describe('BUY', () => {
    const buy = (quantity: number, key?: string) =>
      service.placeOrder(
        'user-1',
        { symbol: 'AAPL', side: 'BUY', type: 'MARKET', quantity },
        key,
      );

    it('fills the order: takes the cash, adds shares, records the trade', async () => {
      givenCash('100000');

      const order = await buy(10);

      expect(order).toMatchObject({
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 10,
        price: '190.00',
        status: 'FILLED',
      });
      expect(
        firstArg(tx.wallet.update).data.cashBalance.decrement.toFixed(2),
      ).toBe('1900.00');
      expect(firstArg(tx.position.create).data).toMatchObject({
        quantity: 10,
        averagePrice: D('190'),
      });
      expect(firstArg(tx.transaction.create).data).toMatchObject({
        type: 'BUY',
        quantity: 10,
        amount: D('1900'),
      });
    });

    it('allows spending exactly the whole balance', async () => {
      givenCash('1900');

      expect((await buy(10)).status).toBe('FILLED');
    });

    it('rejects when there is not enough cash, and changes nothing', async () => {
      givenCash('1899.99');

      const order = await buy(10);

      expect(order.status).toBe('REJECTED');
      expect(order.rejectReason).toBe(INSUFFICIENT_FUNDS);
      expect(order.price).toBeNull();
      expect(tx.wallet.update).not.toHaveBeenCalled();
      expect(tx.position.create).not.toHaveBeenCalled();
      expect(tx.transaction.create).not.toHaveBeenCalled();
      expect(tx.outboxEvent.create).not.toHaveBeenCalled();
    });

    it('recomputes the weighted average price of an existing position', async () => {
      givenCash('100000');
      // 2 shares @ 100 + 1 share @ 190 = 390 / 3 shares = 130
      givenPosition(2, '100');

      await buy(1);

      const { data } = firstArg(tx.position.update);
      expect(data.quantity).toBe(3);
      expect(data.averagePrice.toFixed(4)).toBe('130.0000');
    });

    it('rounds the average price to 4 decimals', async () => {
      givenCash('100000');
      // A price that doesn't divide evenly: the DB column holds 4 decimals
      stocksService.getBySymbolOrThrow.mockResolvedValue({
        ...apple,
        currentPrice: D('101'),
      });
      givenPosition(2, '100'); // (200 + 101) / 3 = 100.3333...

      await buy(1);

      expect(firstArg(tx.position.update).data.averagePrice.toString()).toBe(
        '100.3333',
      );
    });

    it('writes an order.filled event to the outbox in the same transaction', async () => {
      givenCash('100000');

      await buy(10);

      expect(firstArg(tx.outboxEvent.create).data).toEqual({
        type: 'order.filled',
        payload: expect.objectContaining({
          orderId: 'order-1',
          userId: 'user-1',
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 10,
          price: '190.00',
          amount: '1900.00',
        }),
      });
    });
  });

  describe('SELL', () => {
    const sell = (quantity: number) =>
      service.placeOrder('user-1', {
        symbol: 'AAPL',
        side: 'SELL',
        type: 'MARKET',
        quantity,
      });

    beforeEach(() => givenCash('0'));

    it('pays the cash and keeps the remaining shares at the same average price', async () => {
      givenPosition(10, '150');

      const order = await sell(4);

      expect(order.status).toBe('FILLED');
      expect(
        firstArg(tx.wallet.update).data.cashBalance.increment.toFixed(2),
      ).toBe('760.00');
      // Only the quantity changes: selling never touches averagePrice
      expect(firstArg(tx.position.update).data).toEqual({ quantity: 6 });
    });

    it('deletes the position when every share is sold', async () => {
      givenPosition(4, '150');

      await sell(4);

      expect(tx.position.delete).toHaveBeenCalledWith({
        where: { id: 'position-1' },
      });
      expect(tx.position.update).not.toHaveBeenCalled();
    });

    it('rejects selling a stock the user does not own', async () => {
      const order = await sell(1);

      expect(order.status).toBe('REJECTED');
      expect(order.rejectReason).toBe(INSUFFICIENT_SHARES);
      expect(tx.wallet.update).not.toHaveBeenCalled();
    });

    it('rejects selling more shares than the user holds', async () => {
      givenPosition(3, '150');

      const order = await sell(4);

      expect(order.rejectReason).toBe(INSUFFICIENT_SHARES);
      expect(tx.position.update).not.toHaveBeenCalled();
      expect(tx.position.delete).not.toHaveBeenCalled();
    });
  });

  describe('wallet lock', () => {
    it('locks the wallet row with SELECT ... FOR UPDATE', async () => {
      givenCash('100000');

      await service.placeOrder('user-1', {
        symbol: 'AAPL',
        side: 'BUY',
        type: 'MARKET',
        quantity: 1,
      });

      // $queryRaw is a tagged template: the first argument is the SQL parts
      const sql = (firstArg(tx.$queryRaw) as string[]).join('?');
      expect(sql).toMatch(/FOR UPDATE/);
    });

    it('throws 404 when the user has no wallet', async () => {
      tx.$queryRaw.mockResolvedValue([]);

      await expect(
        service.placeOrder('user-1', {
          symbol: 'AAPL',
          side: 'BUY',
          type: 'MARKET',
          quantity: 1,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('Idempotency-Key', () => {
    const KEY = '0f8fad5b-d9cb-469f-a165-70867728950e';
    const buy = (quantity: number) =>
      service.placeOrder(
        'user-1',
        { symbol: 'AAPL', side: 'BUY', type: 'MARKET', quantity },
        KEY,
      );

    beforeEach(() => givenCash('100000'));

    it('saves the key on the new order', async () => {
      await buy(10);

      expect(firstArg(tx.order.create).data.idempotencyKey).toBe(KEY);
    });

    it('returns the original order for a retry, without trading again', async () => {
      tx.order.findUnique.mockResolvedValue({
        id: 'order-original',
        stockId: 'stock-aapl',
        side: 'BUY',
        type: 'MARKET',
        quantity: 10,
        price: D('190'),
        status: 'FILLED',
        rejectReason: null,
        createdAt: new Date(),
        executedAt: new Date(),
      });

      const order = await buy(10);

      expect(order.id).toBe('order-original');
      expect(tx.wallet.update).not.toHaveBeenCalled();
      expect(tx.order.create).not.toHaveBeenCalled();
    });

    it('checks the key only AFTER taking the lock', async () => {
      await buy(10);

      // Otherwise two parallel retries could both miss each other's order
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.order.findUnique.mock.invocationCallOrder[0],
      );
    });

    it('returns 422 when the key was used for a different order', async () => {
      tx.order.findUnique.mockResolvedValue({
        id: 'order-original',
        stockId: 'stock-aapl',
        side: 'BUY',
        quantity: 5,
      });

      await expect(buy(10)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(tx.wallet.update).not.toHaveBeenCalled();
    });

    it('turns a duplicate-key error from the database into 409', async () => {
      prisma.$transaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(buy(10)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  it('propagates 404 for an unknown stock without opening a transaction', async () => {
    stocksService.getBySymbolOrThrow.mockRejectedValue(
      new NotFoundException('Stock NOPE not found'),
    );

    await expect(
      service.placeOrder('user-1', {
        symbol: 'NOPE',
        side: 'BUY',
        type: 'MARKET',
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
