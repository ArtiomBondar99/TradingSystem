import { ApiProperty } from '@nestjs/swagger';
import { DataSourceDto } from '../../market-data/dto/market-data-response.dto.js';
import {
  TIMEFRAMES,
  type Timeframe,
} from '../../market-data/market-data.types.js';

export class IndicatorPointDto {
  /** Same time as the candle it belongs to (Unix seconds) */
  time: number;
  value: number;
}

class IndicatorResponseBase {
  symbol: string;

  @ApiProperty({ enum: TIMEFRAMES })
  timeframe: Timeframe;

  // The indicator is only as real as the prices it was computed from
  source: DataSourceDto;
}

export class LineIndicatorResponseDto extends IndicatorResponseBase {
  points: IndicatorPointDto[];
}

export class MacdResponseDto extends IndicatorResponseBase {
  macd: IndicatorPointDto[];
  signal: IndicatorPointDto[];
  histogram: IndicatorPointDto[];
}

export class BollingerResponseDto extends IndicatorResponseBase {
  upper: IndicatorPointDto[];
  middle: IndicatorPointDto[];
  lower: IndicatorPointDto[];
}

export class PivotLevelsDto {
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

export class PivotsResponseDto extends IndicatorResponseBase {
  /** The completed period the levels were computed from */
  @ApiProperty({ enum: ['day', 'week', 'month'] })
  basedOn: 'day' | 'week' | 'month';
  periodStart: number;
  levels: PivotLevelsDto;
}

export class PriceLevelDto {
  price: number;
  touches: number;
  lastTouch: number;
}

export class LevelsResponseDto extends IndicatorResponseBase {
  supports: PriceLevelDto[];
  resistances: PriceLevelDto[];
}
