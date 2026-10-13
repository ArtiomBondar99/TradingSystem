// Shapes of the backend's JSON responses (see backend/src/**/dto).
// Money is always a string such as "1900.00": the backend does the math with
// Decimal, and the frontend only formats it for display.

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = LoginRequest & {
  firstName: string;
  lastName: string;
};

export type LoginResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
};

export type Stock = {
  symbol: string;
  name: string;
  currentPrice: string;
  updatedAt: string;
};

export type Position = {
  symbol: string;
  name: string;
  quantity: number;
  averagePrice: string;
  currentPrice: string;
  marketValue: string;
  unrealizedPnL: string;
  unrealizedPnLPercent: string;
};

export type Portfolio = {
  cashBalance: string;
  positionsValue: string;
  totalValue: string;
  unrealizedPnL: string;
  positions: Position[];
};

// ----- Market data (backend/src/market-data) -----
// Prices here are numbers: they feed charts and indicators, not balances.

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

export type DataKind = 'REALTIME' | 'DELAYED' | 'HISTORICAL' | 'SIMULATED';

export type DataSource = {
  provider: string;
  kind: DataKind;
  description: string;
};

export type MarketDataSource = DataSource & { timeframes: Timeframe[] };

export type Candle = {
  // Bar start, Unix seconds (UTC); daily/weekly bars: midnight UTC of the date
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type CandlesResponse = {
  symbol: string;
  timeframe: Timeframe;
  source: DataSource;
  candles: Candle[];
};

export type Quote = {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  timestamp: string;
  source: DataSource;
};

export type MarketStatus = {
  isOpen: boolean;
  session: 'PRE_MARKET' | 'REGULAR' | 'AFTER_HOURS' | 'CLOSED';
  timezone: string;
  nextOpen: string;
  nextClose: string | null;
};

export type SymbolSearchResult = { symbol: string; name: string };

// Every error response has this shape (backend AllExceptionsFilter)
export type ApiErrorBody = {
  statusCode: number;
  error: string;
  message: string;
  // Only for validation errors: one entry per invalid field
  errors?: string[];
  requestId: string;
};
