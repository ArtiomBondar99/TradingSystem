import { ApiProperty } from '@nestjs/swagger';
import {
  TIMEFRAMES,
  type DataKind,
  type MarketSession,
  type Timeframe,
} from '../market-data.types.js';

// Response shapes, as classes so Swagger can document them

export class DataSourceDto {
  /** @example simulated */
  provider: string;

  @ApiProperty({ enum: ['REALTIME', 'DELAYED', 'HISTORICAL', 'SIMULATED'] })
  kind: DataKind;

  description: string;
}

export class MarketDataSourceDto extends DataSourceDto {
  // The timeframes this provider supports; the UI offers only these
  @ApiProperty({ enum: TIMEFRAMES, isArray: true })
  timeframes: Timeframe[];
}

export class CandleDto {
  /** Bar start, Unix seconds (UTC). Daily and weekly bars: midnight UTC of the date. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class CandlesResponseDto {
  symbol: string;

  @ApiProperty({ enum: TIMEFRAMES })
  timeframe: Timeframe;

  source: DataSourceDto;
  candles: CandleDto[];
}

export class QuoteResponseDto {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  /** When this price was valid (the last close while the market is closed) */
  timestamp: string;
  source: DataSourceDto;
}

export class MarketStatusDto {
  isOpen: boolean;

  @ApiProperty({ enum: ['PRE_MARKET', 'REGULAR', 'AFTER_HOURS', 'CLOSED'] })
  session: MarketSession;

  /** @example America/New_York */
  timezone: string;
  nextOpen: string;
  nextClose: string | null;
}

export class SymbolSearchResultDto {
  /** @example AAPL */
  symbol: string;
  /** @example Apple Inc. */
  name: string;
}
