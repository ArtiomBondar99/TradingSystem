import { jest } from '@jest/globals';
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from '../cache/cache.service.js';
import type { StockResponseDto } from '../stocks/dto/stock-response.dto.js';
import { StocksService } from '../stocks/stocks.service.js';
import type { Candle, Quote } from './market-data.types.js';
import { MarketDataService } from './market-data.service.js';
import {
  MARKET_DATA_PROVIDER,
  MarketDataUnavailableError,
  type MarketDataProvider,
} from './providers/market-data.provider.js';

describe('MarketDataService', () => {
  let service: MarketDataService;

  const provider = {
    source: { provider: 'fake', kind: 'DELAYED', description: 'Test data' },
    timeframes: ['1h', '1D'],
    getCandles: jest.fn<MarketDataProvider['getCandles']>(),
    getQuote: jest.fn<MarketDataProvider['getQuote']>(),
  } satisfies MarketDataProvider;

  const stocksService = {
    findAll: jest.fn<() => Promise<StockResponseDto[]>>(),
    findBySymbol: jest.fn<(symbol: string) => Promise<StockResponseDto>>(),
  };

  // A cache that always misses: remember() just calls load()
  const cache = {
    remember: jest.fn(
      (_key: string, _ttl: number, load: () => Promise<unknown>) => load(),
    ),
  };

  const stock = (symbol: string, name: string): StockResponseDto => ({
    symbol,
    name,
    currentPrice: '100.00',
    updatedAt: new Date(),
  });

  const candle: Candle = {
    time: 1,
    open: 1,
    high: 2,
    low: 0.5,
    close: 1.5,
    volume: 10,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    stocksService.findBySymbol.mockImplementation((symbol) =>
      Promise.resolve(stock(symbol, `${symbol} Inc.`)),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketDataService,
        { provide: MARKET_DATA_PROVIDER, useValue: provider },
        { provide: StocksService, useValue: stocksService },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = module.get(MarketDataService);
  });

  describe('getCandles', () => {
    it('returns the bars together with where they come from', async () => {
      provider.getCandles.mockResolvedValue([candle]);

      const response = await service.getCandles('AAPL', '1h', 100);

      expect(response).toEqual({
        symbol: 'AAPL',
        timeframe: '1h',
        source: provider.source,
        candles: [candle],
      });
      expect(provider.getCandles).toHaveBeenCalledWith('AAPL', '1h', 100);
    });

    it('caches per provider, symbol, timeframe and limit', async () => {
      provider.getCandles.mockResolvedValue([candle]);

      await service.getCandles('AAPL', '1D', 300);

      expect(cache.remember).toHaveBeenCalledWith(
        'market:candles:fake:AAPL:1D:300',
        60,
        expect.any(Function),
      );
    });

    it('returns 404 for an unknown stock without calling the provider', async () => {
      stocksService.findBySymbol.mockRejectedValue(new NotFoundException());

      await expect(service.getCandles('ZZZZ', '1D', 10)).rejects.toThrow(
        NotFoundException,
      );
      expect(provider.getCandles).not.toHaveBeenCalled();
    });

    it('refuses a timeframe the provider does not support', async () => {
      await expect(service.getCandles('AAPL', '1m', 10)).rejects.toThrow(
        BadRequestException,
      );
      expect(provider.getCandles).not.toHaveBeenCalled();
    });

    it('turns a provider failure into 503, hiding its details', async () => {
      provider.getCandles.mockRejectedValue(
        new MarketDataUnavailableError('upstream 500: internal secret details'),
      );

      const error = await service
        .getCandles('AAPL', '1D', 10)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as Error).message).not.toContain('secret');
    });
  });

  describe('getQuote', () => {
    const quote: Quote = {
      symbol: 'AAPL',
      price: 101,
      previousClose: 100,
      change: 1,
      changePercent: 1,
      timestamp: '2026-10-13T15:00:00.000Z',
    };

    it('adds the data source to the quote', async () => {
      provider.getQuote.mockResolvedValue(quote);

      await expect(service.getQuote('AAPL')).resolves.toEqual({
        ...quote,
        source: provider.source,
      });
    });

    it('turns a provider timeout into 503', async () => {
      provider.getQuote.mockRejectedValue(new Error('ETIMEDOUT'));

      await expect(service.getQuote('AAPL')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('getFreshQuote skips the cache (the price sync needs the latest)', async () => {
      provider.getQuote.mockResolvedValue(quote);

      await service.getFreshQuote('AAPL');

      expect(cache.remember).not.toHaveBeenCalled();
    });
  });

  describe('search', () => {
    beforeEach(() => {
      stocksService.findAll.mockResolvedValue([
        stock('AAPL', 'Apple Inc.'),
        stock('AMZN', 'Amazon.com, Inc.'),
        stock('MA', 'Mastercard Incorporated'),
        stock('MAR', 'Marriott International, Inc.'),
        stock('META', 'Meta Platforms, Inc.'),
      ]);
    });

    it('matches symbols and company names, case-insensitively', async () => {
      const results = await service.search('apple');

      expect(results).toEqual([{ symbol: 'AAPL', name: 'Apple Inc.' }]);
    });

    it('ranks an exact symbol first, then symbol prefixes, then names', async () => {
      const results = await service.search('ma');

      // MA (exact), MAR (prefix), AMZN ("Amazon" contains "ma").
      // META doesn't match at all: neither "META" nor "Meta Platforms" has "ma".
      expect(results.map((r) => r.symbol)).toEqual(['MA', 'MAR', 'AMZN']);
    });
  });

  it('reports the provider and its timeframes', () => {
    expect(service.getSource()).toEqual({
      provider: 'fake',
      kind: 'DELAYED',
      description: 'Test data',
      timeframes: ['1h', '1D'],
    });
  });
});
