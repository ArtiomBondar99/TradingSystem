import {
  MiddlewareConsumer,
  Module,
  NestModule,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration.js';
import { validateEnv } from './config/env.validation.js';
import { createLoggerOptions } from './config/logger.config.js';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { RateLimitGuard } from './common/guards/rate-limit.guard.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { WalletsModule } from './wallets/wallets.module.js';
import { StocksModule } from './stocks/stocks.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { PortfolioModule } from './portfolio/portfolio.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';
import { MarketDataModule } from './market-data/market-data.module.js';
import { IndicatorsModule } from './indicators/indicators.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { DatabaseModule } from './database/database.module.js';
import { CacheModule } from './cache/cache.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // The repo keeps one .env at its root (docker compose reads it too).
      // A backend/.env, if present, wins. In Docker neither file exists:
      // the variables come from docker-compose.yml.
      envFilePath: ['.env', '../.env'],
      load: [configuration],
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: createLoggerOptions,
    }),
    DatabaseModule,
    CacheModule,
    MessagingModule,
    HealthModule,
    AuthModule,
    UsersModule,
    WalletsModule,
    StocksModule,
    OrdersModule,
    PortfolioModule,
    TransactionsModule,
    MarketDataModule,
    IndicatorsModule,
    RealtimeModule,
    NotificationsModule,
  ],
  providers: [
    // Registered here (not with app.useGlobalFilters in main.ts) so it also
    // applies in e2e tests and can use dependency injection
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Rate limiting on every route: 100 requests/minute per IP by default,
    // stricter on /auth. Over the limit = 429 + Retry-After header.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
