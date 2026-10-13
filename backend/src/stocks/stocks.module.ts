import { Module } from '@nestjs/common';
import { StocksController } from './stocks.controller.js';
import { StocksRepository } from './stocks.repository.js';
import { StocksService } from './stocks.service.js';

@Module({
  controllers: [StocksController],
  providers: [StocksService, StocksRepository],
  // Orders will need StocksService to look up a stock before buying
  exports: [StocksService],
})
export class StocksModule {}
