import { Controller, Get, Param } from '@nestjs/common';
import { StockResponseDto } from './dto/stock-response.dto.js';
import { StockSymbolParamDto } from './dto/stock-symbol-param.dto.js';
import { StocksService } from './stocks.service.js';

// Public: browsing the stock list doesn't require logging in
@Controller('stocks')
export class StocksController {
  constructor(private readonly stocksService: StocksService) {}

  @Get()
  findAll(): Promise<StockResponseDto[]> {
    return this.stocksService.findAll();
  }

  @Get(':symbol')
  findBySymbol(
    @Param() { symbol }: StockSymbolParamDto,
  ): Promise<StockResponseDto> {
    return this.stocksService.findBySymbol(symbol);
  }
}
