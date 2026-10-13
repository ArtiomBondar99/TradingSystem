import { api } from './api';
import type {
  Order,
  OrderPage,
  OrderPreview,
  OrderStatus,
  PlaceOrderRequest,
} from './types';

/**
 * The Idempotency-Key makes a retry safe: if the first request reached the
 * server but its response got lost, sending the SAME key again returns the
 * original order instead of buying twice.
 */
export async function placeOrder(
  order: PlaceOrderRequest,
  idempotencyKey: string,
): Promise<Order> {
  const { data } = await api.post<Order>('/orders', order, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return data;
}

// Nothing is traded: the server estimates price, fee and total with the
// same rules it uses for real orders
export async function previewOrder(
  order: PlaceOrderRequest,
): Promise<OrderPreview> {
  const { data } = await api.post<OrderPreview>('/orders/preview', order);
  return data;
}

export async function getOrders(params: {
  status?: OrderStatus;
  symbol?: string;
  limit?: number;
}): Promise<OrderPage> {
  const { data } = await api.get<OrderPage>('/orders', { params });
  return data;
}

export async function cancelOrder(id: string): Promise<Order> {
  const { data } = await api.post<Order>(`/orders/${id}/cancel`);
  return data;
}
