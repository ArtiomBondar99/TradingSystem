import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, type Stock } from '../generated/prisma/client.js';
import { StocksRepository } from './stocks.repository.js';
import { StocksService } from './stocks.service.js';

describe('StocksService', () => {
  let service: StocksService;
  const stocksRepository = {
    findAll: jest.fn<StocksRepository['findAll']>(),
    findBySymbol: jest.fn<StocksRepository['findBySymbol']>(),
  };

  const apple: Stock = {
    id: 'stock-1',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    currentPrice: new Prisma.Decimal('190'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StocksService,
        { provide: StocksRepository, useValue: stocksRepository },
      ],
    }).compile();

    service = module.get(StocksService);
  });

  it('lists stocks with prices as exact 2-decimal strings', async () => {
    stocksRepository.findAll.mockResolvedValue([apple]);

    const stocks = await service.findAll();

    expect(stocks).toEqual([
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        currentPrice: '190.00',
        updatedAt: apple.updatedAt,
      },
    ]);
  });

  it('does not expose the internal id', async () => {
    stocksRepository.findBySymbol.mockResolvedValue(apple);

    const stock = await service.findBySymbol('AAPL');

    expect(stock).not.toHaveProperty('id');
  });

  it('throws 404 for an unknown symbol', async () => {
    stocksRepository.findBySymbol.mockResolvedValue(null);

    await expect(service.findBySymbol('NOPE')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
