import { IsEnum, IsOptional } from 'class-validator';
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
}
