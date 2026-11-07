import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { StockSymbolParamDto } from '../stocks/dto/stock-symbol-param.dto.js';
import { WatchlistItemResponseDto } from './dto/watchlist-item-response.dto.js';
import { WatchlistService } from './watchlist.service.js';

// PUT and DELETE on /watchlist/:symbol, not POST: both are idempotent, so a
// double click or a network retry can't add a stock twice or fail on remove
@ApiTags('watchlist')
@ApiBearerAuth()
@Controller('watchlist')
@UseGuards(JwtAuthGuard)
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Get()
  getMyWatchlist(
    @CurrentUser('userId') userId: string,
  ): Promise<WatchlistItemResponseDto[]> {
    return this.watchlistService.getMyWatchlist(userId);
  }

  @Put(':symbol')
  @HttpCode(HttpStatus.NO_CONTENT)
  add(
    @CurrentUser('userId') userId: string,
    @Param() { symbol }: StockSymbolParamDto,
  ): Promise<void> {
    return this.watchlistService.add(userId, symbol);
  }

  @Delete(':symbol')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser('userId') userId: string,
    @Param() { symbol }: StockSymbolParamDto,
  ): Promise<void> {
    return this.watchlistService.remove(userId, symbol);
  }
}
