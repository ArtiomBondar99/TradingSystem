import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma, type Wallet } from '../generated/prisma/client.js';

export type PositionWithStock = Prisma.PositionGetPayload<{
  include: { stock: true };
}>;

export type PortfolioSnapshot = {
  wallet: Wallet | null;
  positions: PositionWithStock[];
};

@Injectable()
export class PortfolioRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Both reads see the same moment in time (REPEATABLE READ). Otherwise an
  // order could land between them: cash already paid, shares not yet shown.
  async findByUserId(userId: string): Promise<PortfolioSnapshot> {
    const [wallet, positions] = await this.prisma.$transaction(
      [
        this.prisma.wallet.findUnique({ where: { userId } }),
        // include = one query with a JOIN, not one extra query per position
        this.prisma.position.findMany({
          where: { userId },
          include: { stock: true },
          orderBy: { stock: { symbol: 'asc' } },
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );

    return { wallet, positions };
  }
}
