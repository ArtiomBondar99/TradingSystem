import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { CandlesQueryDto } from '../../market-data/dto/market-data-query.dto.js';

// Every indicator takes ?timeframe=&limit= like the candles endpoint, so its
// points line up with the bars on the chart. The parameters below have the
// usual textbook defaults.

const MAX_PERIOD = 200;

export class SmaQueryDto extends CandlesQueryDto {
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(MAX_PERIOD)
  period: number = 20;
}

export class EmaQueryDto extends SmaQueryDto {}

export class RsiQueryDto extends CandlesQueryDto {
  @ApiPropertyOptional({ default: 14 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(100)
  period: number = 14;
}

export class MacdQueryDto extends CandlesQueryDto {
  @ApiPropertyOptional({ default: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(100)
  fast: number = 12;

  @ApiPropertyOptional({ default: 26 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(MAX_PERIOD)
  slow: number = 26;

  @ApiPropertyOptional({ default: 9 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(100)
  signal: number = 9;
}

export class BollingerQueryDto extends SmaQueryDto {
  @ApiPropertyOptional({ default: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(5)
  stdDev: number = 2;
}

export class LevelsQueryDto extends CandlesQueryDto {
  /** Bars on each side that a swing high/low must beat */
  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(20)
  window: number = 5;

  /** Levels to return on each side of the price */
  @ApiPropertyOptional({ default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  maxLevels: number = 3;

  /** Swings closer than this percentage are merged into one level */
  @ApiPropertyOptional({ default: 0.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.05)
  @Max(5)
  tolerancePercent: number = 0.5;
}
