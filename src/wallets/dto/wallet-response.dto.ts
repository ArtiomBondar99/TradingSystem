import type { Wallet } from '../../generated/prisma/client.js';

export class WalletResponseDto {
  id: string;
  // A string such as "100000.00", never a JS number, so no precision is lost
  balance: string;
  currency: string;
  updatedAt: Date;

  static fromEntity(wallet: Wallet): WalletResponseDto {
    return {
      id: wallet.id,
      balance: wallet.balance.toFixed(2),
      currency: wallet.currency,
      updatedAt: wallet.updatedAt,
    };
  }
}
