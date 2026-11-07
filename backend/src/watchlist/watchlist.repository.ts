import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

export type WatchlistItemWithStock = Prisma.WatchlistItemGetPayload<{
  include: { stock: true };
}>;

export type AddResult = 'added' | 'exists' | 'full';

@Injectable()
export class WatchlistRepository {
  constructor(private readonly prisma: PrismaService) {}

  // In the order the user added them; id breaks ties (UUIDv7 = time order)
  findByUserId(userId: string): Promise<WatchlistItemWithStock[]> {
    return this.prisma.watchlistItem.findMany({
      where: { userId },
      include: { stock: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  /**
   * Adds the stock unless it's already there or the list is full.
   *
   * "Count, then insert" is a race: two parallel requests at 49 items both
   * count 49 and both insert, giving 51. Locking the user's row makes this
   * user's adds wait for each other. FOR NO KEY UPDATE (not FOR UPDATE):
   * inserting an order or a transaction for this user only needs a KEY
   * SHARE lock on the same row, which this one doesn't block.
   */
  add(userId: string, stockId: string, max: number): Promise<AddResult> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM users WHERE id = ${userId}::uuid FOR NO KEY UPDATE
      `;

      const existing = await tx.watchlistItem.findUnique({
        where: { userId_stockId: { userId, stockId } },
      });
      if (existing) {
        return 'exists';
      }

      if ((await tx.watchlistItem.count({ where: { userId } })) >= max) {
        return 'full';
      }

      await tx.watchlistItem.create({ data: { userId, stockId } });
      return 'added';
    });
  }

  // deleteMany: removing something that isn't there is not an error
  async remove(userId: string, stockId: string): Promise<void> {
    await this.prisma.watchlistItem.deleteMany({ where: { userId, stockId } });
  }
}
