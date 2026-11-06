import type {
  Candle,
  DataSource,
  Quote,
  Timeframe,
} from '../market-data.types.js';

// Injection token: MarketDataService asks for "the provider" and the module
// decides which implementation that is (simulated now, a real API later).
export const MARKET_DATA_PROVIDER = Symbol('MARKET_DATA_PROVIDER');

export interface MarketDataProvider {
  readonly source: DataSource;
  // Only these are offered to the UI: not every provider supports every one
  readonly timeframes: readonly Timeframe[];

  /** The most recent `limit` bars, oldest first */
  getCandles(
    symbol: string,
    timeframe: Timeframe,
    limit: number,
  ): Promise<Candle[]>;

  getQuote(symbol: string): Promise<Quote>;

  /**
   * Many quotes at once, for the price sync. A real API has a request limit
   * (Alpaca free: 200/min), so 25 stocks every few seconds must be ONE request.
   * Symbols the provider doesn't know are left out of the result.
   */
  getQuotes(symbols: readonly string[]): Promise<Quote[]>;
}

// Thrown by a provider when the upstream API fails (network, 5xx, rate limit)
export class MarketDataUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MarketDataUnavailableError';
  }
}
