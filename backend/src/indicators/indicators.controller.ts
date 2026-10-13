import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CandlesQueryDto } from '../market-data/dto/market-data-query.dto.js';
import { StockSymbolParamDto } from '../stocks/dto/stock-symbol-param.dto.js';
import {
  BollingerQueryDto,
  EmaQueryDto,
  LevelsQueryDto,
  MacdQueryDto,
  RsiQueryDto,
  SmaQueryDto,
} from './dto/indicator-query.dto.js';
import {
  BollingerResponseDto,
  LevelsResponseDto,
  LineIndicatorResponseDto,
  MacdResponseDto,
  PivotsResponseDto,
} from './dto/indicator-response.dto.js';
import { IndicatorsService } from './indicators.service.js';

// One endpoint per indicator: each has its own parameters (validated by its
// own DTO), and the UI fetches and caches only the ones that are switched on.
// Public, like the market data they are computed from.
@ApiTags('indicators')
@Controller('indicators/:symbol')
export class IndicatorsController {
  constructor(private readonly indicators: IndicatorsService) {}

  /** Simple Moving Average */
  @Get('sma')
  sma(
    @Param() { symbol }: StockSymbolParamDto,
    @Query() { timeframe, limit, period }: SmaQueryDto,
  ): Promise<LineIndicatorResponseDto> {
    return this.indicators.sma(symbol, timeframe, limit, period);
  }

  /** Exponential Moving Average */
  @Get('ema')
  ema(
    @Param() { symbol }: StockSymbolParamDto,
    @Query() { timeframe, limit, period }: EmaQueryDto,
  ): Promise<LineIndicatorResponseDto> {
    return this.indicators.ema(symbol, timeframe, limit, period);
  }

  /** Relative Strength Index (0-100) */
  @Get('rsi')
  rsi(
    @Param() { symbol }: StockSymbolParamDto,
    @Query() { timeframe, limit, period }: RsiQueryDto,
  ): Promise<LineIndicatorResponseDto> {
    return this.indicators.rsi(symbol, timeframe, limit, period);
  }

  /** MACD line, signal line and histogram */
  @Get('macd')
  macd(
    @Param() { symbol }: StockSymbolParamDto,
    @Query() { timeframe, limit, fast, slow, signal }: MacdQueryDto,
  ): Promise<MacdResponseDto> {
    return this.indicators.macd(symbol, timeframe, limit, fast, slow, signal);
  }

  /** Bollinger Bands */
  @Get('bollinger')
  bollinger(
    @Param() { symbol }: StockSymbolParamDto,
    @Query() { timeframe, limit, period, stdDev }: BollingerQueryDto,
  ): Promise<BollingerResponseDto> {
    return this.indicators.bollinger(symbol, timeframe, limit, period, stdDev);
  }

  /** Volume Weighted Average Price, restarting each trading day (intraday only) */
  @Get('vwap')
  vwap(
    @Param() { symbol }: StockSymbolParamDto,
    @Query() { timeframe, limit }: CandlesQueryDto,
  ): Promise<LineIndicatorResponseDto> {
    return this.indicators.vwap(symbol, timeframe, limit);
  }

  /** Classic pivot points from the previous day / week / month */
  @Get('pivots')
  pivots(
    @Param() { symbol }: StockSymbolParamDto,
    @Query() { timeframe, limit }: CandlesQueryDto,
  ): Promise<PivotsResponseDto> {
    return this.indicators.pivots(symbol, timeframe, limit);
  }

  /** Support and resistance levels from swing highs and lows */
  @Get('levels')
  levels(
    @Param() { symbol }: StockSymbolParamDto,
    @Query()
    { timeframe, limit, window, maxLevels, tolerancePercent }: LevelsQueryDto,
  ): Promise<LevelsResponseDto> {
    return this.indicators.levels(
      symbol,
      timeframe,
      limit,
      window,
      maxLevels,
      tolerancePercent,
    );
  }
}
