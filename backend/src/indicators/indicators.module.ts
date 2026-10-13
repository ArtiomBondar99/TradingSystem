import { Module } from '@nestjs/common';
import { MarketDataModule } from '../market-data/market-data.module.js';
import { IndicatorsController } from './indicators.controller.js';
import { IndicatorsService } from './indicators.service.js';

@Module({
  imports: [MarketDataModule],
  controllers: [IndicatorsController],
  providers: [IndicatorsService],
})
export class IndicatorsModule {}
