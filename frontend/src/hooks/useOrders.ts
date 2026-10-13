import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { cancelOrder, getOrders, placeOrder } from '../services/orders.service';
import type { PlaceOrderRequest } from '../services/types';

// After any change to orders, everything they touch is out of date.
// useCallback: the same function every render, so it can be an effect dependency.
function useRefreshAfterTrade() {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio'] }),
      ]),
    [queryClient],
  );
}

// LIMIT orders waiting for their price. Polled every 3s, since the
// backend's matcher can fill them at any moment (WebSocket push later).
export function useOpenOrders() {
  const refresh = useRefreshAfterTrade();
  const query = useQuery({
    queryKey: ['orders', 'open'],
    queryFn: () => getOrders({ status: 'PENDING', limit: 50 }),
    refetchInterval: 3_000,
  });

  // An order that left the open list was just filled (or cancelled):
  // refresh the cash, the positions and the history right away.
  // A string, so the effect runs only when the list really changes.
  const openIds = query.data?.items.map((order) => order.id).join(',');
  const previousIds = useRef<string[]>([]);
  useEffect(() => {
    if (openIds === undefined) return;
    const ids = openIds ? openIds.split(',') : [];
    if (previousIds.current.some((id) => !ids.includes(id))) {
      void refresh();
    }
    previousIds.current = ids;
  }, [openIds, refresh]);

  return query;
}

export function useOrderHistory() {
  return useQuery({
    queryKey: ['orders', 'history'],
    queryFn: () => getOrders({ limit: 20 }),
  });
}

export function usePlaceOrder() {
  const refresh = useRefreshAfterTrade();
  return useMutation({
    mutationFn: ({
      order,
      idempotencyKey,
    }: {
      order: PlaceOrderRequest;
      idempotencyKey: string;
    }) => placeOrder(order, idempotencyKey),
    onSuccess: refresh,
  });
}

export function useCancelOrder() {
  const refresh = useRefreshAfterTrade();
  return useMutation({
    mutationFn: cancelOrder,
    // Also after a 409 (it filled meanwhile): the lists are stale either way
    onSettled: refresh,
  });
}
