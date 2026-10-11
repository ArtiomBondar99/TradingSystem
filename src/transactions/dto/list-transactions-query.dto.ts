import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// GET /transactions?limit=20&cursor=<nextCursor from the previous page>
export class ListTransactionsQueryDto {
  // Query params always arrive as strings: "20" -> 20 ("abc" -> NaN, rejected)
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be a whole number' })
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit: number = DEFAULT_PAGE_SIZE;

  // The id of the last item of the previous page; omit it for the first page
  @IsOptional()
  @IsUUID('all', { message: 'cursor must be a valid id' })
  cursor?: string;
}
