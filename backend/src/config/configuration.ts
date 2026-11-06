// Called by ConfigModule AFTER it has loaded .env, so read process.env in here
export default () => {
  const marketDataProvider = process.env.MARKET_DATA_PROVIDER ?? 'simulated';

  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
    database: {
      url: process.env.DATABASE_URL,
    },
    redis: {
      url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    },
    rabbitmq: {
      // Dev default, matches docker-compose.yml; set RABBITMQ_URL everywhere else
      url:
        process.env.RABBITMQ_URL ?? 'amqp://trading:change_me@localhost:5672',
    },
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    },
    app: {
      environment: process.env.NODE_ENV ?? 'development',
      logLevel: process.env.LOG_LEVEL ?? 'info',
    },
    rateLimit: {
      // On everywhere except tests, where one runner creates dozens of users
      // per minute from the same IP. Set RATE_LIMIT_ENABLED to force it.
      enabled:
        (process.env.RATE_LIMIT_ENABLED ??
          String(process.env.NODE_ENV !== 'test')) === 'true',
    },
    marketData: {
      // simulated | alpaca (validated in env.validation.ts)
      provider: marketDataProvider,
      // How often provider prices are copied into stocks.current_price (the
      // price orders execute at). 0 = off: the default in tests, where e2e
      // tests need prices that hold still. Alpaca: every 2s = 30 of the free
      // plan's 200 requests/min, leaving the rest for charts.
      syncIntervalMs: parseInt(
        process.env.MARKET_DATA_SYNC_INTERVAL_MS ??
          (process.env.NODE_ENV === 'test'
            ? '0'
            : marketDataProvider === 'alpaca'
              ? '2000'
              : '1000'),
        10,
      ),
    },
    alpaca: {
      keyId: process.env.ALPACA_API_KEY_ID,
      secretKey: process.env.ALPACA_API_SECRET_KEY,
      dataUrl: process.env.ALPACA_DATA_URL ?? 'https://data.alpaca.markets',
    },
    // Simulated execution rules (src/orders/execution-rules.ts). All on by
    // default, all off in tests, whose expected numbers assume plain fills;
    // test/trading-rules.e2e-spec.ts turns them back on.
    trading: {
      feesEnabled:
        (process.env.TRADING_FEES_ENABLED ??
          String(process.env.NODE_ENV !== 'test')) === 'true',
      slippageBps: parseFloat(
        process.env.TRADING_SLIPPAGE_BPS ??
          (process.env.NODE_ENV === 'test' ? '0' : '5'),
      ),
      enforceMarketHours:
        (process.env.TRADING_MARKET_HOURS ??
          String(process.env.NODE_ENV !== 'test')) === 'true',
    },
    orders: {
      // How often waiting LIMIT orders are checked against the current price.
      // 0 = off: the default in tests, which run the matcher themselves.
      matchIntervalMs: parseInt(
        process.env.LIMIT_ORDER_MATCH_INTERVAL_MS ??
          (process.env.NODE_ENV === 'test' ? '0' : '2000'),
        10,
      ),
    },
    cors: {
      // Comma-separated browser origins allowed to call the API, e.g.
      // "http://localhost:5173,https://app.example.com". Empty = no CORS.
      origins: (process.env.CORS_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    },
  };
};
