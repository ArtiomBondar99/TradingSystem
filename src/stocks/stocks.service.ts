import { Injectable, NotFoundException } from '@nestjs/common';
import { CacheService } from '../cache/cache.service.js';
import type { Stock } from '../generated/prisma/client.js';
import { StockResponseDto } from './dto/stock-response.dto.js';
import {
  STOCKS_CACHE_TTL_SECONDS,
  stocksCacheKeys,
} from './stocks.constants.js';
import { StocksRepository } from './stocks.repository.js';

@Injectable()
export class StocksService {
  constructor(
    private readonly stocksRepository: StocksRepository,
    private readonly cache: CacheService,
  ) {}

  // Public read endpoints: served from Redis, a few seconds stale at most
  findAll(): Promise<StockResponseDto[]> {
    return this.cache.remember(
      stocksCacheKeys.all,
      STOCKS_CACHE_TTL_SECONDS,
      async () => {
        const stocks = await this.stocksRepository.findAll();
        return stocks.map((stock) => StockResponseDto.fromEntity(stock));
      },
    );
  }

  findBySymbol(symbol: string): Promise<StockResponseDto> {
    return this.cache.remember(
      stocksCacheKeys.bySymbol(symbol),
      STOCKS_CACHE_TTL_SECONDS,
      async () =>
        StockResponseDto.fromEntity(await this.getBySymbolOrThrow(symbol)),
    );
  }

  // For other modules (Orders): returns the entity, so the price stays a Decimal.
  // Never cached: a trade must execute at the price in the database, not at
  // a copy that may be 30 seconds old.
  async getBySymbolOrThrow(symbol: string): Promise<Stock> {
    const stock = await this.stocksRepository.findBySymbol(symbol);

    if (!stock) {
      throw new NotFoundException(`Stock ${symbol} not found`);
    }

    return stock;
  }
}
