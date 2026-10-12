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
  // "190.00" when FILLED, null when REJECTED (it never executed)
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
