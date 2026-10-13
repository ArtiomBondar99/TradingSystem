import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import {
  cancelOrder,
  getOrders,
  placeOrder,
  previewOrder,
} from '../services/orders.service';
import type { PlaceOrderRequest } from '../services/types';
import { useIsLive } from './useRealtimeStore';

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

// LIMIT/STOP orders waiting for their price. The matcher can fill them at
// any moment: the WebSocket pushes the fill, polling is the fallback.
export function useOpenOrders() {
  const refresh = useRefreshAfterTrade();
  const live = useIsLive();
  const query = useQuery({
    queryKey: ['orders', 'open'],
    queryFn: () => getOrders({ status: 'PENDING', limit: 50 }),
    // Live: a fill is pushed (and refreshes this list); polling is the fallback
    refetchInterval: live ? 15_000 : 3_000,
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

// This stock's executed orders: the buy/sell markers on its chart
export function useFilledOrders(symbol: string) {
  return useQuery({
    queryKey: ['orders', 'filled', symbol],
    queryFn: () => getOrders({ status: 'FILLED', symbol, limit: 100 }),
  });
}

/**
 * The server's estimate for the order being typed. `order` is null while the
 * form is incomplete. Debounced by the caller, so typing "100" asks once.
 */
export function useOrderPreview(order: PlaceOrderRequest | null) {
  return useQuery({
    queryKey: ['orders', 'preview', order],
    queryFn: () => previewOrder(order as PlaceOrderRequest),
    enabled: order !== null,
    // The market moves: refresh the estimate while the form is open
    refetchInterval: 5_000,
    // Keep showing the last estimate while the next one loads
    placeholderData: keepPreviousData,
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
