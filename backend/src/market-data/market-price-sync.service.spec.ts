import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client.js';
import type { StockResponseDto } from '../stocks/dto/stock-response.dto.js';
import { StocksService } from '../stocks/stocks.service.js';
import type { Quote } from './market-data.types.js';
import { MarketDataService } from './market-data.service.js';
import { MarketPriceSyncService } from './market-price-sync.service.js';

describe('MarketPriceSyncService', () => {
  let service: MarketPriceSyncService;

  const stocksService = {
    findAll: jest.fn<() => Promise<StockResponseDto[]>>(),
    updatePrice: jest.fn<StocksService['updatePrice']>(),
  };
  const marketData = {
    getFreshQuote: jest.fn<(symbol: string) => Promise<Quote>>(),
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
      ],
    }).compile();

    service = module.get(MarketPriceSyncService);
  });

  it('writes only the prices that changed, as exact Decimals', async () => {
    stocksService.findAll.mockResolvedValue([
      stock('AAPL', '190.00'),
      stock('MSFT', '420.00'),
    ]);
    marketData.getFreshQuote.mockImplementation((symbol) =>
      Promise.resolve(
        symbol === 'AAPL' ? quote('AAPL', 191.5) : quote('MSFT', 420),
      ),
    );

    const updated = await service.syncPrices();

    expect(updated).toBe(1);
    expect(stocksService.updatePrice).toHaveBeenCalledTimes(1);
    expect(stocksService.updatePrice).toHaveBeenCalledWith(
      'AAPL',
      new Prisma.Decimal('191.50'),
    );
  });

  it('does nothing when the interval is 0 (the test default)', () => {
    service.onApplicationBootstrap();

    expect(stocksService.findAll).not.toHaveBeenCalled();
  });
});
