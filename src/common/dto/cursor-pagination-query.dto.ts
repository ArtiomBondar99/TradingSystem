import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ?limit=20&cursor=<nextCursor from the previous page>
// Shared by every cursor-paginated list (GET /orders, GET /transactions)
export class CursorPaginationQueryDto {
  // Query params always arrive as strings: "20" -> 20 ("abc" -> NaN, rejected).
  // Optional for the client (it has a default), so tell Swagger explicitly:
  // it only sees "limit: number" and would mark it required.
  @ApiPropertyOptional()
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
