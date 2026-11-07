import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma, TransactionType } from '../generated/prisma/client.js';

export type TransactionWithStock = Prisma.TransactionGetPayload<{
  include: { stock: true };
}>;

export type TransactionFilters = {
  type?: TransactionType;
  symbol?: string;
};

@Injectable()
export class TransactionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Keyset (cursor) pagination: "give me the rows after this one", not
  // OFFSET. OFFSET 40000 still makes Postgres read and skip 40000 rows, and
  // shows duplicates when new trades arrive between pages.
  findPageByUserId(
    userId: string,
    take: number,
    cursor?: string,
    filters: TransactionFilters = {},
  ): Promise<TransactionWithStock[]> {
    return this.prisma.transaction.findMany({
      where: {
        userId,
        ...(filters.type && { type: filters.type }),
        ...(filters.symbol && { stock: { symbol: filters.symbol } }),
      },
      include: { stock: true },
      // Newest first; id breaks ties between trades in the same millisecond.
      // Served by the (user_id, created_at) index; the filters are checked
      // on the rows it walks (one user's trades: a small set).
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });
  }
}
