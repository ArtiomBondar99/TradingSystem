// Payload of the "order.filled" event. Plain JSON: money as strings, dates as
// ISO strings, so every consumer (in any language) reads it the same way.
// A type, not an interface: only a type alias is accepted by Prisma's Json field.
export type OrderFilledEvent = {
  orderId: string;
  userId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: string;
  amount: string;
  // Commission: cash moved = amount + fee (BUY) or amount - fee (SELL)
  fee: string;
  executedAt: string;
};
