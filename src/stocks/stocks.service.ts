import { Injectable, NotFoundException } from '@nestjs/common';
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
    const stock = await this.stocksRepository.findBySymbol(symbol);

    if (!stock) {
      throw new NotFoundException(`Stock ${symbol} not found`);
    }

    return StockResponseDto.fromEntity(stock);
  }
}
