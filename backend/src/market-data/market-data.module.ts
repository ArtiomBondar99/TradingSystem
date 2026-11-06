import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StocksModule } from '../stocks/stocks.module.js';
import { MarketDataController } from './market-data.controller.js';
import { MarketDataService } from './market-data.service.js';
import { MarketPriceSyncService } from './market-price-sync.service.js';
import { PriceFeed } from './price-feed.service.js';
import { AlpacaMarketDataProvider } from './providers/alpaca.provider.js';
import {
  MARKET_DATA_PROVIDER,
  type MarketDataProvider,
} from './providers/market-data.provider.js';
import { SimulatedMarketDataProvider } from './providers/simulated.provider.js';

@Module({
  imports: [StocksModule],
  controllers: [MarketDataController],
  providers: [
    MarketDataService,
    MarketPriceSyncService,
    PriceFeed,
    // The one place that picks the data provider (MARKET_DATA_PROVIDER).
    // Everything else asks for the token and never knows which one it got.
    // The keys were already checked at startup (env.validation.ts).
    {
      provide: MARKET_DATA_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): MarketDataProvider =>
        config.getOrThrow<string>('marketData.provider') === 'alpaca'
          ? new AlpacaMarketDataProvider({
              keyId: config.getOrThrow<string>('alpaca.keyId'),
              secretKey: config.getOrThrow<string>('alpaca.secretKey'),
              dataUrl: config.getOrThrow<string>('alpaca.dataUrl'),
            })
          : new SimulatedMarketDataProvider(),
    },
  ],
  // PriceFeed: the WebSocket gateway pushes its quotes to the browser
  exports: [MarketDataService, PriceFeed],
})
export class MarketDataModule {}
