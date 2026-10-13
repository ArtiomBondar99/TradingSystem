import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TIMEFRAMES, type Timeframe } from '../market-data.types.js';

export const DEFAULT_CANDLES = 300;
export const MAX_CANDLES = 1000;

// GET /market-data/:symbol/candles?timeframe=1h&limit=300
export class CandlesQueryDto {
  @ApiPropertyOptional({ enum: TIMEFRAMES, default: '1D' })
  @IsOptional()
  @IsIn(TIMEFRAMES, {
    message: `timeframe must be one of: ${TIMEFRAMES.join(', ')}`,
  })
  timeframe: Timeframe = '1D';

  @ApiPropertyOptional({ default: DEFAULT_CANDLES })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be a whole number' })
  @Min(1)
  @Max(MAX_CANDLES)
  limit: number = DEFAULT_CANDLES;
}

// GET /market-data/search?q=app
export class SearchQueryDto {
  /** @example app */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'q must not be empty' })
  @MaxLength(50)
  q: string;
}
