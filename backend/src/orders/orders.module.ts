import { Module } from '@nestjs/common';
import { StocksModule } from '../stocks/stocks.module.js';
import { LimitOrderMatcher } from './limit-order-matcher.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersRepository } from './orders.repository.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [StocksModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository, LimitOrderMatcher],
})
export class OrdersModule {}
