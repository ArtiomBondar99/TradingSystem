import { etDate } from '../market-calendar.js';
import {
  TIMEFRAMES,
  type Candle,
  type DataSource,
  type Quote,
  type Timeframe,
} from '../market-data.types.js';
import {
  MarketDataUnavailableError,
  type MarketDataProvider,
} from './market-data.provider.js';

export type AlpacaOptions = {
  keyId: string;
  secretKey: string;
  // https://data.alpaca.markets: the MARKET DATA API. The paper-api.alpaca.markets
  // endpoint is the trading API (orders at Alpaca), which we never use.
  dataUrl: string;
};

// The free plan streams only IEX (one exchange, ~2-3% of US volume) in real
// time. "sip" (all exchanges) needs a paid plan for the latest 15 minutes.
const FEED = 'iex';
const REQUEST_TIMEOUT_MS = 5_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const ALPACA_TIMEFRAMES: Record<Timeframe, string> = {
  '1m': '1Min',
  '5m': '5Min',
  '15m': '15Min',
  '30m': '30Min',
  '1h': '1Hour',
  '4h': '4Hour',
  '1D': '1Day',
  '1W': '1Week',
};

const BAR_MINUTES: Partial<Record<Timeframe, number>> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '4h': 240,
};

// Only the fields we read from Alpaca's JSON
type AlpacaBar = {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};
type AlpacaSnapshot = {
  latestTrade?: { t: string; p: number } | null;
  dailyBar?: AlpacaBar | null;
  prevDailyBar?: AlpacaBar | null;
};

/**
 * Real prices from Alpaca's market data API (free plan, IEX feed).
 * Plain class, no Nest decorators: MarketDataModule builds it from config,
 * and tests build it with a fake fetch.
 */
export class AlpacaMarketDataProvider implements MarketDataProvider {
  readonly source: DataSource = {
    provider: 'alpaca',
    kind: 'REALTIME',
    description:
      'Real-time trades from the IEX exchange (Alpaca free plan). IEX is ~2-3% ' +
      'of US volume, so prices can differ slightly from the full market.',
  };
  readonly timeframes = TIMEFRAMES;

  constructor(
    private readonly options: AlpacaOptions,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async getCandles(
    symbol: string,
    timeframe: Timeframe,
    limit: number,
  ): Promise<Candle[]> {
    const params = new URLSearchParams({
      timeframe: ALPACA_TIMEFRAMES[timeframe],
      limit: String(limit),
      // Newest first: "the last N bars". Without it Alpaca returns the
      // first N bars after `start`.
      sort: 'desc',
      start: barsStart(timeframe, limit, Date.now()),
      // Prices before a stock split are divided, so the chart has no cliff
      adjustment: 'split',
      feed: FEED,
    });
    const body = await this.get<{ bars: AlpacaBar[] | null }>(
      `/v2/stocks/${encodeURIComponent(symbol)}/bars?${params}`,
    );
    const intraday = BAR_MINUTES[timeframe] !== undefined;

    return (body.bars ?? []).map((bar) => toCandle(bar, intraday)).reverse(); // the interface promises oldest first
  }

  async getQuote(symbol: string): Promise<Quote> {
    const [quote] = await this.getQuotes([symbol]);
    if (!quote) {
      throw new MarketDataUnavailableError(`Alpaca has no data for ${symbol}`);
    }
    return quote;
  }

  async getQuotes(symbols: readonly string[]): Promise<Quote[]> {
    if (symbols.length === 0) {
      return [];
    }
    const params = new URLSearchParams({
      symbols: symbols.join(','),
      feed: FEED,
    });
    // One request for every symbol: { "AAPL": {...}, "MSFT": {...} }.
    // Symbols Alpaca doesn't know are simply missing from the map.
    const snapshots = await this.get<Record<string, AlpacaSnapshot>>(
      `/v2/stocks/snapshots?${params}`,
    );

    return symbols.flatMap((symbol) => {
      const snapshot = snapshots[symbol];
      return snapshot ? toQuote(symbol, snapshot) : [];
    });
  }

  private async get<T>(path: string): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchFn(`${this.options.dataUrl}${path}`, {
        headers: {
          'APCA-API-KEY-ID': this.options.keyId,
          'APCA-API-SECRET-KEY': this.options.secretKey,
        },
        // A hanging request must not freeze the price sync forever
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new MarketDataUnavailableError(
        `Alpaca request failed: ${(error as Error).message}`,
        { cause: error },
      );
    }

    if (!response.ok) {
      // 401 bad keys, 403 plan doesn't allow it, 429 over the rate limit.
      // The message never contains the keys, so it is safe to log.
      const text = await response.text().catch(() => '');
      throw new MarketDataUnavailableError(
        `Alpaca responded ${response.status}: ${text.slice(0, 200)}`,
      );
    }
    return (await response.json()) as T;
  }
}

function toQuote(symbol: string, snapshot: AlpacaSnapshot): Quote[] {
  const trade = snapshot.latestTrade;
  if (!trade) {
    return [];
  }

  // The previous close is the close of the last trading day BEFORE the
  // latest trade. Before today's first trade, dailyBar is still yesterday's.
  const tradeDay = etDate(new Date(trade.t));
  const daily = snapshot.dailyBar;
  const previousBar =
    daily && etDate(new Date(daily.t)) < tradeDay
      ? daily
      : snapshot.prevDailyBar;

  const price = round2(trade.p);
  const previousClose = round2(previousBar?.c ?? trade.p);
  const change = round2(price - previousClose);

  return [
    {
      symbol,
      price,
      previousClose,
      change,
      changePercent: round2((change / previousClose) * 100),
      timestamp: new Date(trade.t).toISOString(),
    },
  ];
}

function toCandle(bar: AlpacaBar, intraday: boolean): Candle {
  // Alpaca stamps daily/weekly bars at midnight New York (04:00/05:00 UTC).
  // Our convention (market-data.types.ts) is midnight UTC of that date.
  const time = intraday
    ? Date.parse(bar.t) / 1000
    : Date.parse(`${etDate(new Date(bar.t))}T00:00:00Z`) / 1000;

  return {
    time,
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
  };
}

/**
 * How far back to ask for bars, so that `limit` of them fit after `start`.
 * Alpaca wants a start (its default is today 00:00, which is empty on a
 * weekend). Generous on purpose: nights, weekends and holidays have no bars.
 */
export function barsStart(
  timeframe: Timeframe,
  limit: number,
  now: number,
): string {
  const minutes = BAR_MINUTES[timeframe];
  let backMs: number;

  if (minutes !== undefined) {
    // ~6.5 trading hours a day, 5 days a week: ~5x the bar span in calendar
    // time. 6x plus a week covers holidays.
    backMs = limit * minutes * 60_000 * 6 + 7 * DAY_MS;
  } else if (timeframe === '1D') {
    backMs = (limit * 1.5 + 10) * DAY_MS;
  } else {
    backMs = (limit * 7 + 14) * DAY_MS;
  }
  return new Date(now - backMs).toISOString();
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
