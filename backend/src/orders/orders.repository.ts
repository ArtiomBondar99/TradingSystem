import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { OrderStatus, Prisma } from '../generated/prisma/client.js';

export type OrderWithStock = Prisma.OrderGetPayload<{
  include: { stock: true };
}>;

// Read side of orders. Placing an order stays in OrdersService, inside its
// locked transaction.
@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Same keyset pagination as transactions (see TransactionsRepository)
  findPageByUserId(
    userId: string,
    take: number,
    cursor?: string,
    status?: OrderStatus,
    symbol?: string,
  ): Promise<OrderWithStock[]> {
    return this.prisma.order.findMany({
      where: {
        userId,
        ...(status && { status }),
        ...(symbol && { stock: { symbol } }),
      },
      include: { stock: true },
      // Newest first; served by the (user_id, created_at) index
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });
  }
}
