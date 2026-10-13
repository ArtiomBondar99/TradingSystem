import { api } from './api';
import type { Order, OrderPage, OrderStatus, PlaceOrderRequest } from './types';

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

export async function getOrders(params: {
  status?: OrderStatus;
  limit?: number;
}): Promise<OrderPage> {
  const { data } = await api.get<OrderPage>('/orders', { params });
  return data;
}

export async function cancelOrder(id: string): Promise<Order> {
  const { data } = await api.post<Order>(`/orders/${id}/cancel`);
  return data;
}
