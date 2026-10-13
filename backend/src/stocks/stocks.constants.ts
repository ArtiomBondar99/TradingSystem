// How long a stock price may be served from Redis before we re-read Postgres
export const STOCKS_CACHE_TTL_SECONDS = 30;

export const stocksCacheKeys = {
  all: 'stocks:all',
  bySymbol: (symbol: string) => `stocks:${symbol}`,
};
