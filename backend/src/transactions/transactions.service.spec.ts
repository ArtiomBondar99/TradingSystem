import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client.js';
import {
  TransactionsRepository,
  type TransactionWithStock,
} from './transactions.repository.js';
import { TransactionsService } from './transactions.service.js';

describe('TransactionsService', () => {
  let service: TransactionsService;
  const transactionsRepository = {
    findPageByUserId: jest.fn<TransactionsRepository['findPageByUserId']>(),
  };

  const row = (id: string): TransactionWithStock => ({
    id,
    userId: 'user-1',
    orderId: `order-${id}`,
    stockId: 'stock-1',
    type: 'BUY',
    quantity: 3,
    price: new Prisma.Decimal('190'),
    amount: new Prisma.Decimal('570'),
    fee: new Prisma.Decimal('1'),
    createdAt: new Date(),
    stock: {
      id: 'stock-1',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      currentPrice: new Prisma.Decimal('190'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: TransactionsRepository, useValue: transactionsRepository },
      ],
    }).compile();

    service = module.get(TransactionsService);
  });

  it('maps rows to DTOs with symbol and exact money strings', async () => {
    transactionsRepository.findPageByUserId.mockResolvedValue([row('t1')]);

    const page = await service.getMyTransactions('user-1', { limit: 20 });

    expect(page.items[0]).toMatchObject({
      id: 't1',
      symbol: 'AAPL',
      price: '190.00',
      amount: '570.00',
      fee: '1.00',
    });
    expect(page.items[0]).not.toHaveProperty('userId');
  });

  it('asks for one extra row to detect the next page', async () => {
    transactionsRepository.findPageByUserId.mockResolvedValue([]);

    await service.getMyTransactions('user-1', { limit: 2, cursor: 'c1' });

    expect(transactionsRepository.findPageByUserId).toHaveBeenCalledWith(
      'user-1',
      3,
      'c1',
    );
  });

  it('returns a nextCursor when there are more rows', async () => {
    transactionsRepository.findPageByUserId.mockResolvedValue([
      row('t1'),
      row('t2'),
      row('t3'),
    ]);

    const page = await service.getMyTransactions('user-1', { limit: 2 });

    expect(page.items.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(page.nextCursor).toBe('t2');
  });

  it('returns nextCursor null on the last page', async () => {
    transactionsRepository.findPageByUserId.mockResolvedValue([
      row('t1'),
      row('t2'),
    ]);

    const page = await service.getMyTransactions('user-1', { limit: 2 });

    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
  });
});
