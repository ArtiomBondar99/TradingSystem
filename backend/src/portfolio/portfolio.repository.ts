import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma, type Wallet } from '../generated/prisma/client.js';

export type PositionWithStock = Prisma.PositionGetPayload<{
  include: { stock: true };
}>;

export type PortfolioSnapshot = {
  wallet: Wallet | null;
  positions: PositionWithStock[];
  // Sum of every sale's realized P&L (0 before the first sale)
  realizedPnL: Prisma.Decimal;
};

@Injectable()
export class PortfolioRepository {
  constructor(private readonly prisma: PrismaService) {}

  // All reads see the same moment in time (REPEATABLE READ). Otherwise an
  // order could land between them: cash already paid, shares not yet shown,
  // or a sale's profit counted while its shares are still listed.
  async findByUserId(userId: string): Promise<PortfolioSnapshot> {
    const [wallet, positions, sales] = await this.prisma.$transaction(
      [
        this.prisma.wallet.findUnique({ where: { userId } }),
        // include = one query with a JOIN, not one extra query per position
        this.prisma.position.findMany({
          where: { userId },
          include: { stock: true },
          orderBy: { stock: { symbol: 'asc' } },
        }),
        // SUM in the database: one number back, not every sale ever made
        this.prisma.transaction.aggregate({
          where: { userId, type: 'SELL' },
          _sum: { realizedPnL: true },
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );

    return {
      wallet,
      positions,
      realizedPnL: sales._sum.realizedPnL ?? new Prisma.Decimal(0),
    };
  }
}
