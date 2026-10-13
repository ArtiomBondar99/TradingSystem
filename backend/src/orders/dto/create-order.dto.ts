import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { OrderSide, OrderType } from '../../generated/prisma/client.js';

// A sanity cap, not a business rule: stops typos like 10000000 from reaching the DB
export const MAX_ORDER_QUANTITY = 1_000_000;
export const MAX_LIMIT_PRICE = 1_000_000;

export class CreateOrderDto {
  /** Case-insensitive: "aapl" works too. @example AAPL */
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{1,10}$/, {
    message: 'symbol must be 1-10 letters, e.g. AAPL',
  })
  symbol: string;

  /** @example BUY */
  @IsEnum(OrderSide, { message: 'side must be BUY or SELL' })
  side: OrderSide;

  // Optional: without it, the order is a MARKET order
  @ApiPropertyOptional({ enum: OrderType, default: OrderType.MARKET })
  @IsOptional()
  @IsEnum(OrderType, { message: 'type must be MARKET, LIMIT or STOP' })
  type: OrderType = OrderType.MARKET;

  /** @example 10 */
  // Whole shares only. IsInt rejects 1.5, "10" and 10.0000001
  @IsInt({ message: 'quantity must be a whole number' })
  @Min(1, { message: 'quantity must be at least 1' })
  @Max(MAX_ORDER_QUANTITY)
  quantity: number;

  /**
   * LIMIT orders only: buy at this price or lower, sell at this price or
   * higher. Dollars and cents (at most 2 decimals). @example 185.5
   */
  // Required for LIMIT; a MARKET order with one is refused by the service
  @ValidateIf((order: CreateOrderDto) => order.type === OrderType.LIMIT)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'limitPrice must be a price with at most 2 decimals' },
  )
  @Min(0.01, { message: 'limitPrice must be at least 0.01' })
  @Max(MAX_LIMIT_PRICE)
  limitPrice?: number;

  /**
   * STOP orders only: a BUY triggers when the price rises to it, a SELL when
   * it falls to it (stop-loss); then it executes at market. @example 175
   */
  @ValidateIf((order: CreateOrderDto) => order.type === OrderType.STOP)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'stopPrice must be a price with at most 2 decimals' },
  )
  @Min(0.01, { message: 'stopPrice must be at least 0.01' })
  @Max(MAX_LIMIT_PRICE)
  stopPrice?: number;
}
