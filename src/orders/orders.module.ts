import { Module } from '@nestjs/common';
import { StocksModule } from '../stocks/stocks.module.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [StocksModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
