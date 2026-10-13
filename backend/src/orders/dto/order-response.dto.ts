import type {
  Order,
  OrderSide,
  OrderStatus,
  OrderType,
} from '../../generated/prisma/client.js';

export class OrderResponseDto {
  id: string;
  // The client knows stocks by symbol, never by our internal stockId
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  // LIMIT orders: the price asked for; null for MARKET orders
  limitPrice: string | null;
  // "190.00" when FILLED, null otherwise (it hasn't executed, or never will)
  price: string | null;
  status: OrderStatus;
  rejectReason: string | null;
  createdAt: Date;
  executedAt: Date | null;

  static fromEntity(order: Order, symbol: string): OrderResponseDto {
    return {
      id: order.id,
      symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
      limitPrice: order.limitPrice?.toFixed(2) ?? null,
      price: order.price?.toFixed(2) ?? null,
      status: order.status,
      rejectReason: order.rejectReason,
      createdAt: order.createdAt,
      executedAt: order.executedAt,
    };
  }
}

// A class (not CursorPage<OrderResponseDto>) so Swagger can document it
export class OrderPageDto {
  items: OrderResponseDto[];
  // Pass it as ?cursor= to get the next page; null means this was the last one
  nextCursor: string | null;
}
