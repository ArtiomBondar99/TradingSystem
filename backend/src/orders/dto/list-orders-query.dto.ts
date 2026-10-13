import { IsEnum, IsOptional, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { CursorPaginationQueryDto } from '../../common/dto/cursor-pagination-query.dto.js';
import { OrderStatus } from '../../generated/prisma/client.js';

// GET /orders?status=REJECTED&limit=20&cursor=...
export class ListOrdersQueryDto extends CursorPaginationQueryDto {
  // Omit it to get every order, whatever its status
  @IsOptional()
  @IsEnum(OrderStatus, {
    message: `status must be one of: ${Object.values(OrderStatus).join(', ')}`,
  })
  status?: OrderStatus;

  // Only this stock's orders, e.g. for the buy/sell markers on its chart
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{1,10}$/, {
    message: 'symbol must be 1-10 letters, e.g. AAPL',
  })
  symbol?: string;
}
