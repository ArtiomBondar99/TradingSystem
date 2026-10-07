import type { Wallet } from '../../generated/prisma/client.js';

export class WalletResponseDto {
  id: string;
  // A string such as "100000.00", never a JS number, so no precision is lost
  cashBalance: string;
  currency: string;
  updatedAt: Date;

  static fromEntity(wallet: Wallet): WalletResponseDto {
    return {
      id: wallet.id,
      cashBalance: wallet.cashBalance.toFixed(2),
      currency: wallet.currency,
      updatedAt: wallet.updatedAt,
    };
  }
}
