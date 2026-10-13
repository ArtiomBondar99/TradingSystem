import { Module } from '@nestjs/common';
import { StocksModule } from '../stocks/stocks.module.js';
import { MarketDataController } from './market-data.controller.js';
import { MarketDataService } from './market-data.service.js';
import { MarketPriceSyncService } from './market-price-sync.service.js';
import { MARKET_DATA_PROVIDER } from './providers/market-data.provider.js';
import { SimulatedMarketDataProvider } from './providers/simulated.provider.js';

@Module({
  imports: [StocksModule],
  controllers: [MarketDataController],
  providers: [
    MarketDataService,
    MarketPriceSyncService,
    SimulatedMarketDataProvider,
    // The one place that picks the data provider. Only the simulated one
    // exists for now; a real one (Alpaca) will be chosen here from config.
    { provide: MARKET_DATA_PROVIDER, useExisting: SimulatedMarketDataProvider },
  ],
  exports: [MarketDataService],
})
export class MarketDataModule {}
