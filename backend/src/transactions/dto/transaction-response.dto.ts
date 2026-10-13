import type { TransactionType } from '../../generated/prisma/client.js';
import type { TransactionWithStock } from '../transactions.repository.js';

export class TransactionResponseDto {
  id: string;
  orderId: string;
  symbol: string;
  type: TransactionType;
  quantity: number;
  // Money as strings such as "190.00", never JS numbers
  price: string;
  amount: string;
  createdAt: Date;

  static fromEntity(transaction: TransactionWithStock): TransactionResponseDto {
    return {
      id: transaction.id,
      orderId: transaction.orderId,
      symbol: transaction.stock.symbol,
      type: transaction.type,
      quantity: transaction.quantity,
      price: transaction.price.toFixed(2),
      amount: transaction.amount.toFixed(2),
      createdAt: transaction.createdAt,
    };
  }
}

export class TransactionPageDto {
  items: TransactionResponseDto[];
  // Pass it as ?cursor= to get the next page; null means this was the last one
  nextCursor: string | null;
}
