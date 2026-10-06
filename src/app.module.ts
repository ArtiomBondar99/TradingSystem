import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
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

@Module({
  imports: [
    HealthModule,
    AuthModule,
    UsersModule,
    WalletsModule,
    StocksModule,
    OrdersModule,
    PortfolioModule,
    TransactionsModule,
    MarketDataModule,
    DatabaseModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
