import type { Stock } from '../../generated/prisma/client.js';

export class StockResponseDto {
  symbol: string;
  name: string;
  // A string such as "190.00", never a JS number (same reason as cashBalance)
  currentPrice: string;
  updatedAt: Date;

  static fromEntity(stock: Stock): StockResponseDto {
    return {
      symbol: stock.symbol,
      name: stock.name,
      currentPrice: stock.currentPrice.toFixed(2),
      updatedAt: stock.updatedAt,
    };
  }
}
