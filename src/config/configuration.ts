export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  rabbitmq: {
    // Dev default, matches docker-compose.yml; set RABBITMQ_URL everywhere else
    url: process.env.RABBITMQ_URL ?? 'amqp://trading:change_me@localhost:5672',
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
  cors: {
    // Comma-separated browser origins allowed to call the API, e.g.
    // "http://localhost:5173,https://app.example.com". Empty = no CORS.
    origins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },
});
