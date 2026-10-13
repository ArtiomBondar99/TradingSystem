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

// ----- Orders (backend/src/orders) -----

export type OrderSide = 'BUY' | 'SELL';
// MARKET: now. LIMIT: at the limit or better. STOP: at market, once the
// price crosses the stop (e.g. a stop-loss).
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP';
// PENDING = a LIMIT order waiting for its price
export type OrderStatus = 'PENDING' | 'FILLED' | 'REJECTED' | 'CANCELLED';

export type Order = {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  limitPrice: string | null;
  stopPrice: string | null;
  // Execution price, once FILLED
  price: string | null;
  // Commission charged on the fill
  fee: string;
  status: OrderStatus;
  rejectReason: string | null;
  createdAt: string;
  executedAt: string | null;
};

export type OrderPage = { items: Order[]; nextCursor: string | null };

// No price for a MARKET order: the server decides it. The client never
// tells the server what something costs.
export type PlaceOrderRequest = {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
};

// POST /orders/preview: the server's estimate of what the order would do
export type OrderPreview = {
  symbol: string;
  marketPrice: string;
  marketOpen: boolean;
  executesNow: boolean;
  blockedReason: string | null;
  estimatedPrice: string;
  estimatedAmount: string;
  estimatedFee: string;
  estimatedTotal: string;
  buyingPower: string;
  sellableShares: number;
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

// ----- Indicators (backend/src/indicators) -----

export type IndicatorPoint = { time: number; value: number };

type IndicatorResponseBase = {
  symbol: string;
  timeframe: Timeframe;
  source: DataSource;
};

export type LineIndicatorResponse = IndicatorResponseBase & {
  points: IndicatorPoint[];
};

export type MacdResponse = IndicatorResponseBase & {
  macd: IndicatorPoint[];
  signal: IndicatorPoint[];
  histogram: IndicatorPoint[];
};

export type BollingerResponse = IndicatorResponseBase & {
  upper: IndicatorPoint[];
  middle: IndicatorPoint[];
  lower: IndicatorPoint[];
};

export type PivotsResponse = IndicatorResponseBase & {
  basedOn: 'day' | 'week' | 'month';
  periodStart: number;
  levels: Record<'pivot' | 'r1' | 'r2' | 'r3' | 's1' | 's2' | 's3', number>;
};

export type PriceLevel = { price: number; touches: number; lastTouch: number };

export type LevelsResponse = IndicatorResponseBase & {
  supports: PriceLevel[];
  resistances: PriceLevel[];
};

// Every error response has this shape (backend AllExceptionsFilter)
export type ApiErrorBody = {
  statusCode: number;
  error: string;
  message: string;
  // Only for validation errors: one entry per invalid field
  errors?: string[];
  requestId: string;
};
