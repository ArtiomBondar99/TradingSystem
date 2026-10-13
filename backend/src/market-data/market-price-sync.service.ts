import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import { StocksService } from '../stocks/stocks.service.js';
import { MarketDataService } from './market-data.service.js';

/**
 * Copies the provider's latest prices into stocks.current_price, every few
 * seconds. Orders execute at the price in the database, so this is what
 * makes the price you see on the chart the price you trade at.
 *
 * Safe with several API instances: each one writes the same price.
 */
@Injectable()
export class MarketPriceSyncService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(MarketPriceSyncService.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<unknown>;

  constructor(
    private readonly marketData: MarketDataService,
    private readonly stocksService: StocksService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    const intervalMs = this.config.getOrThrow<number>(
      'marketData.syncIntervalMs',
    );
    // 0 = off (the default in tests, which need prices that hold still)
    if (intervalMs <= 0) {
      return;
    }

    this.tick();
    this.timer = setInterval(() => this.tick(), intervalMs);
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
    await this.running;
  }

  private tick(): void {
    // Skip a tick if the previous sync is still running
    this.running ??= this.syncPrices()
      .catch((error: Error) =>
        this.logger.warn(`Price sync failed: ${error.message}`),
      )
      .finally(() => (this.running = undefined));
  }

  /** Returns how many prices changed */
  async syncPrices(): Promise<number> {
    const stocks = await this.stocksService.findAll();
    let updated = 0;

    for (const stock of stocks) {
      const quote = await this.marketData.getFreshQuote(stock.symbol);
      // Cents, as stored (DECIMAL(18,2)); compared as strings, never floats
      const price = quote.price.toFixed(2);

      if (price !== stock.currentPrice) {
        await this.stocksService.updatePrice(
          stock.symbol,
          new Prisma.Decimal(price),
        );
        updated++;
      }
    }

    return updated;
  }
}
