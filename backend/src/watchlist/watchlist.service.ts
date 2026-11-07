import { ConflictException, Injectable } from '@nestjs/common';
import { PriceFeed } from '../market-data/price-feed.service.js';
import { StocksService } from '../stocks/stocks.service.js';
import { WatchlistItemResponseDto } from './dto/watchlist-item-response.dto.js';
import { WatchlistRepository } from './watchlist.repository.js';

// Enough to follow the market; stops a script from filling the table
export const MAX_WATCHLIST_ITEMS = 50;

@Injectable()
export class WatchlistService {
  constructor(
    private readonly watchlistRepository: WatchlistRepository,
    private readonly stocksService: StocksService,
    private readonly priceFeed: PriceFeed,
  ) {}

  async getMyWatchlist(userId: string): Promise<WatchlistItemResponseDto[]> {
    const items = await this.watchlistRepository.findByUserId(userId);

    return items.map(({ stock, createdAt }) => {
      // Already in memory (the price sync publishes every stock): costs no
      // request to the market data provider
      const quote = this.priceFeed.latestFor(stock.symbol);
      return {
        symbol: stock.symbol,
        name: stock.name,
        currentPrice: stock.currentPrice.toFixed(2),
        change: quote?.change ?? null,
        changePercent: quote?.changePercent ?? null,
        addedAt: createdAt,
      };
    });
  }

  /** Idempotent: adding a stock that is already on the list changes nothing */
  async add(userId: string, symbol: string): Promise<void> {
    // 404 for a stock we don't list
    const stock = await this.stocksService.getBySymbolOrThrow(symbol);

    const result = await this.watchlistRepository.add(
      userId,
      stock.id,
      MAX_WATCHLIST_ITEMS,
    );

    if (result === 'full') {
      throw new ConflictException(
        `Your watchlist is full (${MAX_WATCHLIST_ITEMS} stocks). Remove one to add another.`,
      );
    }
  }

  /** Idempotent: removing a stock that isn't on the list is fine too */
  async remove(userId: string, symbol: string): Promise<void> {
    const stock = await this.stocksService.getBySymbolOrThrow(symbol);
    await this.watchlistRepository.remove(userId, stock.id);
  }
}
