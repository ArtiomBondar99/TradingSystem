import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { CandlesResponseDto } from '../market-data/dto/market-data-response.dto.js';
import type { Candle, Timeframe } from '../market-data/market-data.types.js';
import { MarketDataService } from '../market-data/market-data.service.js';
import { IndicatorsService } from './indicators.service.js';

describe('IndicatorsService', () => {
  let service: IndicatorsService;
  const source = {
    provider: 'fake',
    kind: 'SIMULATED' as const,
    description: '',
  };

  // 1000 bars, one per hour, closes 1, 2, 3, ... (easy averages)
  const candles: Candle[] = Array.from({ length: 1000 }, (_, i) => ({
    time: 1_700_000_000 + i * 3600,
    open: i + 1,
    high: i + 1.5,
    low: i + 0.5,
    close: i + 1,
    volume: 100,
  }));

  const marketData = {
    getCandles: jest.fn(
      (
        symbol: string,
        timeframe: Timeframe,
        limit: number,
      ): Promise<CandlesResponseDto> =>
        Promise.resolve({
          symbol,
          timeframe,
          source,
          candles: candles.slice(-limit),
        }),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IndicatorsService,
        { provide: MarketDataService, useValue: marketData },
      ],
    }).compile();

    service = module.get(IndicatorsService);
  });

  it('computes on 1000 bars but returns only the bars on the chart', async () => {
    const result = await service.sma('AAPL', '1h', 300, 200);

    expect(marketData.getCandles).toHaveBeenCalledWith('AAPL', '1h', 1000);
    // Thanks to the warm-up bars, the 200-SMA covers all 300 visible bars
    expect(result.points).toHaveLength(300);
    expect(result.points[0].time).toBe(candles[700].time);
    // Average of closes 502..701 = 601.5
    expect(result.points[0].value).toBe(601.5);
    expect(result.source).toEqual(source);
  });

  it('refuses MACD with fast >= slow', async () => {
    await expect(service.macd('AAPL', '1D', 300, 26, 12, 9)).rejects.toThrow(
      BadRequestException,
    );
    expect(marketData.getCandles).not.toHaveBeenCalled();
  });

  it('refuses VWAP on daily and weekly charts', async () => {
    await expect(service.vwap('AAPL', '1D', 300)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.vwap('AAPL', '1W', 300)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("bases intraday pivots on the previous day's bar", async () => {
    const result = await service.pivots('AAPL', '5m', 300);

    expect(marketData.getCandles).toHaveBeenCalledWith('AAPL', '1D', 2);
    // The bar before the last: high 999.5, low 998.5, close 999 -> P = 999
    expect(result.basedOn).toBe('day');
    expect(result.levels.pivot).toBe(999);
    expect(result.levels.r1).toBe(999.5);
    expect(result.periodStart).toBe(candles[998].time);
  });

  it('bases daily pivots on the previous week', async () => {
    const result = await service.pivots('AAPL', '1D', 300);

    expect(marketData.getCandles).toHaveBeenCalledWith('AAPL', '1W', 2);
    expect(result.basedOn).toBe('week');
  });

  it('finds levels only in the visible bars', async () => {
    const result = await service.levels('AAPL', '1h', 300, 5, 3, 0.5);

    // A straight uptrend has no swing highs or lows
    expect(result).toMatchObject({ supports: [], resistances: [] });
  });
});
