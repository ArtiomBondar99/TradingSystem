import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Stock } from '../generated/prisma/client.js';

@Injectable()
export class StocksRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Stock[]> {
    return this.prisma.stock.findMany({ orderBy: { symbol: 'asc' } });
  }

  // symbol is @unique, so this is an index lookup, not a table scan
  findBySymbol(symbol: string): Promise<Stock | null> {
    return this.prisma.stock.findUnique({ where: { symbol } });
  }
}
