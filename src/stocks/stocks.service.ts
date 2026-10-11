import { Injectable, NotFoundException } from '@nestjs/common';
import type { Stock } from '../generated/prisma/client.js';
import { StockResponseDto } from './dto/stock-response.dto.js';
import { StocksRepository } from './stocks.repository.js';

@Injectable()
export class StocksService {
  constructor(private readonly stocksRepository: StocksRepository) {}

  async findAll(): Promise<StockResponseDto[]> {
    const stocks = await this.stocksRepository.findAll();
    return stocks.map((stock) => StockResponseDto.fromEntity(stock));
  }

  async findBySymbol(symbol: string): Promise<StockResponseDto> {
    const stock = await this.getBySymbolOrThrow(symbol);
    return StockResponseDto.fromEntity(stock);
  }

  // For other modules (Orders): returns the entity, so the price stays a Decimal
  async getBySymbolOrThrow(symbol: string): Promise<Stock> {
    const stock = await this.stocksRepository.findBySymbol(symbol);

    if (!stock) {
      throw new NotFoundException(`Stock ${symbol} not found`);
    }

    return stock;
  }
}
