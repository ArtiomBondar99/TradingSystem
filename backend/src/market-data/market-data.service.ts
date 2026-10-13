import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CacheService } from '../cache/cache.service.js';
import { StocksService } from '../stocks/stocks.service.js';
import type {
  CandlesResponseDto,
  MarketDataSourceDto,
  MarketStatusDto,
  QuoteResponseDto,
  SymbolSearchResultDto,
} from './dto/market-data-response.dto.js';
import { getMarketStatus } from './market-calendar.js';
import type { Candle, Quote, Timeframe } from './market-data.types.js';
import {
  MARKET_DATA_PROVIDER,
  type MarketDataProvider,
} from './providers/market-data.provider.js';

// How long a response may be served from Redis. Short for fast timeframes,
// longer for slow ones: this is what keeps a real provider (with a
// requests-per-minute limit) from being called on every chart refresh.
const CANDLES_TTL_SECONDS: Record<Timeframe, number> = {
  '1m': 5,
  '5m': 15,
  '15m': 30,
  '30m': 30,
  '1h': 60,
  '4h': 60,
  '1D': 60,
  '1W': 300,
};
const QUOTE_TTL_SECONDS = 2;
const MAX_SEARCH_RESULTS = 10;

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);

  constructor(
    @Inject(MARKET_DATA_PROVIDER)
    private readonly provider: MarketDataProvider,
    private readonly stocksService: StocksService,
    private readonly cache: CacheService,
  ) {}

  getSource(): MarketDataSourceDto {
    return {
      ...this.provider.source,
      timeframes: [...this.provider.timeframes],
    };
  }

  getStatus(now = new Date()): MarketStatusDto {
    return getMarketStatus(now);
  }

  // Searches the tradable stocks (our database), not the provider: a user can
  // only trade what we list, and it costs no provider request
  async search(query: string): Promise<SymbolSearchResultDto[]> {
    const needle = query.toUpperCase();
    const stocks = await this.stocksService.findAll();

    // Best match first: exact symbol, then symbol prefix, then name contains
    const rank = (symbol: string): number =>
      symbol === needle ? 0 : symbol.startsWith(needle) ? 1 : 2;

    return stocks
      .filter(
        (stock) =>
          stock.symbol.startsWith(needle) ||
          stock.name.toUpperCase().includes(needle),
      )
      .sort(
        (a, b) =>
          rank(a.symbol) - rank(b.symbol) || a.symbol.localeCompare(b.symbol),
      )
      .slice(0, MAX_SEARCH_RESULTS)
      .map(({ symbol, name }) => ({ symbol, name }));
  }

  async getCandles(
    symbol: string,
    timeframe: Timeframe,
    limit: number,
  ): Promise<CandlesResponseDto> {
    // 404 for a stock we don't list
    await this.stocksService.findBySymbol(symbol);

    if (!this.provider.timeframes.includes(timeframe)) {
      throw new BadRequestException(
        `Timeframe ${timeframe} is not available from the ${this.provider.source.provider} data provider`,
      );
    }

    const key = `market:candles:${this.provider.source.provider}:${symbol}:${timeframe}:${limit}`;
    const candles = await this.cache.remember<Candle[]>(
      key,
      CANDLES_TTL_SECONDS[timeframe],
      () =>
        this.callProvider(() =>
          this.provider.getCandles(symbol, timeframe, limit),
        ),
    );

    return { symbol, timeframe, source: this.provider.source, candles };
  }

  async getQuote(symbol: string): Promise<QuoteResponseDto> {
    await this.stocksService.findBySymbol(symbol);

    const key = `market:quote:${this.provider.source.provider}:${symbol}`;
    const quote = await this.cache.remember<Quote>(key, QUOTE_TTL_SECONDS, () =>
      this.callProvider(() => this.provider.getQuote(symbol)),
    );

    return { ...quote, source: this.provider.source };
  }

  /** Straight from the provider, no cache: for the price sync */
  getFreshQuote(symbol: string): Promise<Quote> {
    return this.callProvider(() => this.provider.getQuote(symbol));
  }

  // A provider failure (network, outage, rate limit) becomes a clean 503
  // instead of a 500 with the provider's internals. The details go to the log.
  private async callProvider<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      this.logger.warn(
        `Market data provider "${this.provider.source.provider}" failed: ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'Market data is temporarily unavailable. Please try again shortly.',
      );
    }
  }
}
