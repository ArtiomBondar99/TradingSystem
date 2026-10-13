import { Module } from '@nestjs/common';
import { StocksModule } from '../stocks/stocks.module.js';
import { MarketDataController } from './market-data.controller.js';
import { MarketDataService } from './market-data.service.js';
import { MarketPriceSyncService } from './market-price-sync.service.js';
import { PriceFeed } from './price-feed.service.js';
import { MARKET_DATA_PROVIDER } from './providers/market-data.provider.js';
import { SimulatedMarketDataProvider } from './providers/simulated.provider.js';

@Module({
  imports: [StocksModule],
  controllers: [MarketDataController],
  providers: [
    MarketDataService,
    MarketPriceSyncService,
    PriceFeed,
    SimulatedMarketDataProvider,
    // The one place that picks the data provider. Only the simulated one
    // exists for now; a real one (Alpaca) will be chosen here from config.
    { provide: MARKET_DATA_PROVIDER, useExisting: SimulatedMarketDataProvider },
  ],
  // PriceFeed: the WebSocket gateway pushes its quotes to the browser
  exports: [MarketDataService, PriceFeed],
})
export class MarketDataModule {}
