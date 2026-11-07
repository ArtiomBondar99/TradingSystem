import { jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, type Stock } from '../generated/prisma/client.js';
import { PriceFeed } from '../market-data/price-feed.service.js';
import { StocksService } from '../stocks/stocks.service.js';
import {
  WatchlistRepository,
  type WatchlistItemWithStock,
} from './watchlist.repository.js';
import { MAX_WATCHLIST_ITEMS, WatchlistService } from './watchlist.service.js';

describe('WatchlistService', () => {
  let service: WatchlistService;
  // The real one: tiny, no I/O
  let priceFeed: PriceFeed;

  const watchlistRepository = {
    findByUserId: jest.fn<WatchlistRepository['findByUserId']>(),
    add: jest.fn<WatchlistRepository['add']>(),
    remove: jest.fn<WatchlistRepository['remove']>(),
  };
  const stocksService = {
    getBySymbolOrThrow: jest.fn<StocksService['getBySymbolOrThrow']>(),
  };

  const stock = (symbol: string, price: string): Stock => ({
    id: `stock-${symbol}`,
    symbol,
    name: `${symbol} Inc.`,
    currentPrice: new Prisma.Decimal(price),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const item = (symbol: string, price: string): WatchlistItemWithStock => ({
    id: `item-${symbol}`,
    userId: 'user-1',
    stockId: `stock-${symbol}`,
    createdAt: new Date('2026-11-07T10:00:00Z'),
    stock: stock(symbol, price),
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    stocksService.getBySymbolOrThrow.mockImplementation((symbol) =>
      Promise.resolve(stock(symbol, '100')),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WatchlistService,
        { provide: WatchlistRepository, useValue: watchlistRepository },
        { provide: StocksService, useValue: stocksService },
        PriceFeed,
      ],
    }).compile();

    service = module.get(WatchlistService);
    priceFeed = module.get(PriceFeed);
  });

  describe('getMyWatchlist', () => {
    it("adds today's change from the live feed", async () => {
      watchlistRepository.findByUserId.mockResolvedValue([
        item('AAPL', '344.6'),
      ]);
      priceFeed.publish({
        symbol: 'AAPL',
        price: 344.6,
        previousClose: 349.55,
        change: -4.95,
        changePercent: -1.42,
        timestamp: '2026-11-06T21:00:00.000Z',
      });

      await expect(service.getMyWatchlist('user-1')).resolves.toEqual([
        {
          symbol: 'AAPL',
          name: 'AAPL Inc.',
          currentPrice: '344.60',
          change: -4.95,
          changePercent: -1.42,
          addedAt: new Date('2026-11-07T10:00:00Z'),
        },
      ]);
    });

    it('reports no change (null, not 0) before the feed has a quote', async () => {
      watchlistRepository.findByUserId.mockResolvedValue([
        item('MSFT', '536.29'),
      ]);

      const [msft] = await service.getMyWatchlist('user-1');

      expect(msft.change).toBeNull();
      expect(msft.changePercent).toBeNull();
    });
  });

  describe('add', () => {
    it('adds the stock with the list limit', async () => {
      watchlistRepository.add.mockResolvedValue('added');

      await service.add('user-1', 'AAPL');

      expect(watchlistRepository.add).toHaveBeenCalledWith(
        'user-1',
        'stock-AAPL',
        MAX_WATCHLIST_ITEMS,
      );
    });

    it('is fine with a stock that is already on the list', async () => {
      watchlistRepository.add.mockResolvedValue('exists');

      await expect(service.add('user-1', 'AAPL')).resolves.toBeUndefined();
    });

    it('returns 409 when the list is full', async () => {
      watchlistRepository.add.mockResolvedValue('full');

      await expect(service.add('user-1', 'AAPL')).rejects.toThrow(
        ConflictException,
      );
    });

    it('returns 404 for a stock we do not list, without touching the list', async () => {
      stocksService.getBySymbolOrThrow.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(service.add('user-1', 'ZZZZ')).rejects.toThrow(
        NotFoundException,
      );
      expect(watchlistRepository.add).not.toHaveBeenCalled();
    });
  });

  it('removes by stock id', async () => {
    await service.remove('user-1', 'AAPL');

    expect(watchlistRepository.remove).toHaveBeenCalledWith(
      'user-1',
      'stock-AAPL',
    );
  });
});
