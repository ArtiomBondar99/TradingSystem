import { Module } from '@nestjs/common';
import { MarketDataService } from './market-data.service.js';

@Module({
  providers: [MarketDataService],
})
export class MarketDataModule {}
