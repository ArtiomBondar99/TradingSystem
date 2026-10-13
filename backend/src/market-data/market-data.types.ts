// Market data is for analysis and display, so prices here are plain numbers
// (charts and indicators work with floats). Money that changes hands, such
// as wallet balances or execution prices, stays Decimal in the database.

export const TIMEFRAMES = [
  '1m',
  '5m',
  '15m',
  '30m',
  '1h',
  '4h',
  '1D',
  '1W',
] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

// Where a price comes from. The UI shows it next to every chart and quote,
// so simulated or delayed data is never mistaken for a live market feed.
export type DataKind = 'REALTIME' | 'DELAYED' | 'HISTORICAL' | 'SIMULATED';

export type DataSource = {
  provider: string;
  kind: DataKind;
  description: string;
};

export type Candle = {
  // Bar start, Unix seconds (UTC). Daily/weekly bars: midnight UTC of the date.
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Quote = {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  // When this price was valid (the last close while the market is closed)
  timestamp: string;
};

export type MarketSession = 'PRE_MARKET' | 'REGULAR' | 'AFTER_HOURS' | 'CLOSED';

export type MarketStatus = {
  isOpen: boolean;
  session: MarketSession;
  timezone: string;
  // ISO instants
  nextOpen: string;
  nextClose: string | null;
};
