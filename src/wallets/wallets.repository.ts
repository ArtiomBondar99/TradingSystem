import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Wallet } from '../generated/prisma/client.js';

@Injectable()
export class WalletsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserId(userId: string): Promise<Wallet | null> {
    return this.prisma.wallet.findUnique({ where: { userId } });
  }
}
