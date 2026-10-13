import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { StockSymbolParamDto } from '../stocks/dto/stock-symbol-param.dto.js';
import {
  CandlesQueryDto,
  SearchQueryDto,
} from './dto/market-data-query.dto.js';
import {
  CandlesResponseDto,
  MarketDataSourceDto,
  MarketStatusDto,
  QuoteResponseDto,
  SymbolSearchResultDto,
} from './dto/market-data-response.dto.js';
import { MarketDataService } from './market-data.service.js';

// Public, like /stocks: market data needs no account
@ApiTags('market-data')
@Controller('market-data')
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  /** Which provider serves the data, what kind it is, and its timeframes */
  @Get('source')
  getSource(): MarketDataSourceDto {
    return this.marketDataService.getSource();
  }

  /** Is the US stock market open right now? */
  @Get('status')
  getStatus(): MarketStatusDto {
    return this.marketDataService.getStatus();
  }

  /** Find tradable stocks by symbol or company name */
  @Get('search')
  search(@Query() { q }: SearchQueryDto): Promise<SymbolSearchResultDto[]> {
    return this.marketDataService.search(q);
  }

  /** OHLCV bars, oldest first */
  @Get(':symbol/candles')
  @ApiServiceUnavailableResponse({ description: 'The data provider is down' })
  getCandles(
    @Param() { symbol }: StockSymbolParamDto,
    @Query() { timeframe, limit }: CandlesQueryDto,
  ): Promise<CandlesResponseDto> {
    return this.marketDataService.getCandles(symbol, timeframe, limit);
  }

  /** Last price and the change since the previous close */
  @Get(':symbol/quote')
  @ApiServiceUnavailableResponse({ description: 'The data provider is down' })
  getQuote(
    @Param() { symbol }: StockSymbolParamDto,
  ): Promise<QuoteResponseDto> {
    return this.marketDataService.getQuote(symbol);
  }
}
