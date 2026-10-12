import {
  MiddlewareConsumer,
  Module,
  NestModule,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration.js';
import { createLoggerOptions } from './config/logger.config.js';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { WalletsModule } from './wallets/wallets.module.js';
import { StocksModule } from './stocks/stocks.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { PortfolioModule } from './portfolio/portfolio.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';
import { MarketDataModule } from './market-data/market-data.module.js';
import { DatabaseModule } from './database/database.module.js';
import { CacheModule } from './cache/cache.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
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
    NotificationsModule,
  ],
  providers: [
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
