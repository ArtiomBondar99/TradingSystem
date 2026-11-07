import { IsEnum, IsOptional, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { CursorPaginationQueryDto } from '../../common/dto/cursor-pagination-query.dto.js';
import { TransactionType } from '../../generated/prisma/client.js';

// GET /transactions?type=SELL&symbol=AAPL&limit=20&cursor=...
export class ListTransactionsQueryDto extends CursorPaginationQueryDto {
  // Omit it for buys and sells. SELL = the trades that realized a profit/loss.
  @IsOptional()
  @IsEnum(TransactionType, {
    message: `type must be one of: ${Object.values(TransactionType).join(', ')}`,
  })
  type?: TransactionType;

  // Only this stock's trades
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{1,10}$/, {
    message: 'symbol must be 1-10 letters, e.g. AAPL',
  })
  symbol?: string;
}
