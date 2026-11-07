import { Module } from '@nestjs/common';
import { MarketDataModule } from '../market-data/market-data.module.js';
import { StocksModule } from '../stocks/stocks.module.js';
import { WatchlistController } from './watchlist.controller.js';
import { WatchlistRepository } from './watchlist.repository.js';
import { WatchlistService } from './watchlist.service.js';

@Module({
  // MarketDataModule: the SAME PriceFeed instance the price sync fills
  imports: [StocksModule, MarketDataModule],
  controllers: [WatchlistController],
  providers: [WatchlistService, WatchlistRepository],
})
export class WatchlistModule {}
