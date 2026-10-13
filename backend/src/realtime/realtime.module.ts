import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MarketDataModule } from '../market-data/market-data.module.js';
import { StocksModule } from '../stocks/stocks.module.js';
import { RealtimeGateway } from './realtime.gateway.js';

// Live pushes to the browser over WebSocket (/ws). RabbitMqService comes
// from the global MessagingModule.
@Module({
  imports: [AuthModule, MarketDataModule, StocksModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
