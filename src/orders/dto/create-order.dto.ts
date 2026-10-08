import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { OrderSide, OrderType } from '../../generated/prisma/client.js';

// A sanity cap, not a business rule: stops typos like 10000000 from reaching the DB
export const MAX_ORDER_QUANTITY = 1_000_000;

export class CreateOrderDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{1,10}$/, {
    message: 'symbol must be 1-10 letters, e.g. AAPL',
  })
  symbol: string;

  @IsEnum(OrderSide, { message: 'side must be BUY or SELL' })
  side: OrderSide;

  // Only MARKET orders exist for now, so it's optional and defaults to MARKET
  @IsOptional()
  @IsEnum(OrderType, { message: 'type must be MARKET' })
  type: OrderType = OrderType.MARKET;

  // Whole shares only. IsInt rejects 1.5, "10" and 10.0000001
  @IsInt({ message: 'quantity must be a whole number' })
  @Min(1, { message: 'quantity must be at least 1' })
  @Max(MAX_ORDER_QUANTITY)
  quantity: number;
}
