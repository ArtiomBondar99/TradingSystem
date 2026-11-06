import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client.js';
import type { StockResponseDto } from '../stocks/dto/stock-response.dto.js';
import { StocksService } from '../stocks/stocks.service.js';
import type { Quote } from './market-data.types.js';
import { MarketDataService } from './market-data.service.js';
import { MarketPriceSyncService } from './market-price-sync.service.js';
import { PriceFeed } from './price-feed.service.js';

describe('MarketPriceSyncService', () => {
  let service: MarketPriceSyncService;
  // The real one: tiny, no I/O
  let priceFeed: PriceFeed;

  const stocksService = {
    findAll: jest.fn<() => Promise<StockResponseDto[]>>(),
    updatePrice: jest.fn<StocksService['updatePrice']>(),
  };
  const marketData = {
    getFreshQuotes: jest.fn<(symbols: readonly string[]) => Promise<Quote[]>>(),
  };
  const config = { getOrThrow: jest.fn(() => 0) };

  const stock = (symbol: string, currentPrice: string): StockResponseDto => ({
    symbol,
    name: symbol,
    currentPrice,
    updatedAt: new Date(),
  });

  const quote = (symbol: string, price: number): Quote => ({
    symbol,
    price,
    previousClose: price,
    change: 0,
    changePercent: 0,
    timestamp: new Date().toISOString(),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketPriceSyncService,
        { provide: StocksService, useValue: stocksService },
        { provide: MarketDataService, useValue: marketData },
        { provide: ConfigService, useValue: config },
        PriceFeed,
      ],
    }).compile();

    service = module.get(MarketPriceSyncService);
    priceFeed = module.get(PriceFeed);
  });

  it('writes only the prices that changed, as exact Decimals', async () => {
    stocksService.findAll.mockResolvedValue([
      stock('AAPL', '190.00'),
      stock('MSFT', '420.00'),
    ]);
    marketData.getFreshQuotes.mockResolvedValue([
      quote('AAPL', 191.5),
      quote('MSFT', 420),
    ]);

    const updated = await service.syncPrices();

    expect(updated).toBe(1);
    expect(stocksService.updatePrice).toHaveBeenCalledTimes(1);
    expect(stocksService.updatePrice).toHaveBeenCalledWith(
      'AAPL',
      new Prisma.Decimal('191.50'),
    );
  });

  it('asks the provider for all stocks in ONE call (request limits)', async () => {
    stocksService.findAll.mockResolvedValue([
      stock('AAPL', '190.00'),
      stock('MSFT', '420.00'),
      stock('TSLA', '250.00'),
    ]);
    marketData.getFreshQuotes.mockResolvedValue([]);

    await service.syncPrices();

    expect(marketData.getFreshQuotes).toHaveBeenCalledTimes(1);
    expect(marketData.getFreshQuotes).toHaveBeenCalledWith([
      'AAPL',
      'MSFT',
      'TSLA',
    ]);
  });

  it('keeps the last price of a stock the provider does not know', async () => {
    stocksService.findAll.mockResolvedValue([
      stock('AAPL', '190.00'),
      stock('ZZZZ', '50.00'),
    ]);
    // ZZZZ is missing from the answer
    marketData.getFreshQuotes.mockResolvedValue([quote('AAPL', 191.5)]);

    const updated = await service.syncPrices();

    expect(updated).toBe(1);
    expect(stocksService.updatePrice).not.toHaveBeenCalledWith(
      'ZZZZ',
      expect.anything(),
    );
    expect(priceFeed.latestFor('ZZZZ')).toBeUndefined();
  });

  it('does nothing when the interval is 0 (the test default)', () => {
    service.onApplicationBootstrap();

    expect(stocksService.findAll).not.toHaveBeenCalled();
  });

  it('publishes a changed price only after writing it to the database', async () => {
    stocksService.findAll.mockResolvedValue([stock('AAPL', '190.00')]);
    marketData.getFreshQuotes.mockResolvedValue([quote('AAPL', 191.5)]);
    const published: string[] = [];
    // At the moment of publishing, had the database write already happened?
    let writtenFirst = false;
    priceFeed.quotes$.subscribe((q) => {
      published.push(q.symbol);
      writtenFirst = stocksService.updatePrice.mock.calls.length > 0;
    });

    await service.syncPrices();

    expect(published).toEqual(['AAPL']);
    expect(writtenFirst).toBe(true);
    expect(priceFeed.latestFor('AAPL')?.price).toBe(191.5);
  });

  it('publishes an unchanged price once, as the starting quote', async () => {
    stocksService.findAll.mockResolvedValue([stock('MSFT', '420.00')]);
    marketData.getFreshQuotes.mockResolvedValue([quote('MSFT', 420)]);
    const published: string[] = [];
    priceFeed.quotes$.subscribe((q) => published.push(q.symbol));

    await service.syncPrices();
    await service.syncPrices();

    expect(published).toEqual(['MSFT']);
    expect(stocksService.updatePrice).not.toHaveBeenCalled();
  });
});
