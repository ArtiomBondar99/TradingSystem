import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from '../cache/cache.service.js';
import { Prisma, type Stock } from '../generated/prisma/client.js';
import { StocksRepository } from './stocks.repository.js';
import { StocksService } from './stocks.service.js';

describe('StocksService', () => {
  let service: StocksService;
  const stocksRepository = {
    findAll: jest.fn<StocksRepository['findAll']>(),
    findBySymbol: jest.fn<StocksRepository['findBySymbol']>(),
  };
  // By default a cache that always misses: remember() just calls load()
  const cache = {
    remember: jest.fn(
      (_key: string, _ttl: number, load: () => Promise<unknown>) => load(),
    ),
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
        { provide: CacheService, useValue: cache },
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

  it('caches stock lookups under a per-symbol key', async () => {
    stocksRepository.findBySymbol.mockResolvedValue(apple);

    await service.findBySymbol('AAPL');

    expect(cache.remember).toHaveBeenCalledWith(
      'stocks:AAPL',
      expect.any(Number),
      expect.any(Function),
    );
  });

  it('serves a cache hit without touching the database', async () => {
    const cached = { symbol: 'AAPL', currentPrice: '190.00' };
    cache.remember.mockResolvedValueOnce(cached);

    const stock = await service.findBySymbol('AAPL');

    expect(stock).toBe(cached);
    expect(stocksRepository.findBySymbol).not.toHaveBeenCalled();
  });

  it('never uses the cache for the price a trade executes at', async () => {
    stocksRepository.findBySymbol.mockResolvedValue(apple);

    await service.getBySymbolOrThrow('AAPL');

    expect(cache.remember).not.toHaveBeenCalled();
    expect(stocksRepository.findBySymbol).toHaveBeenCalledWith('AAPL');
  });
});
