import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { realtime, type LiveQuote } from '../services/realtime';
import type { Quote, Stock } from '../services/types';
import { useAuthStore } from './useAuthStore';
import { useRealtimeStore } from './useRealtimeStore';

/**
 * Mounted once (AppLayout): keeps the WebSocket open while logged in and
 * feeds what it receives into the rest of the app.
 *
 * Quotes are written straight into the TanStack Query cache (setQueryData),
 * so every component that shows a price re-renders with it: no extra
 * requests, no prop drilling.
 */
export function useRealtimeConnection() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (!token) return;

    const { setStatus, quoteArrived, addFill } = useRealtimeStore.getState();

    const offStatus = realtime.on('status', setStatus);

    const offQuote = realtime.on('quote', (quote: LiveQuote) => {
      quoteArrived(quote.symbol);
      // The quote header (keeps the "source" label from the REST response)
      queryClient.setQueryData<Quote>(
        ['market-data', 'quote', quote.symbol],
        (previous) => previous && { ...previous, ...quote },
      );
      // The market lists
      queryClient.setQueryData<Stock[]>(['stocks'], (stocks) =>
        stocks?.map((stock) =>
          stock.symbol === quote.symbol
            ? { ...stock, currentPrice: quote.price.toFixed(2) }
            : stock,
        ),
      );
    });

    // One of my orders filled (e.g. a limit order, in the background):
    // show it, and refresh everything it changed
    const offOrder = realtime.on('order', (fill) => {
      addFill(fill);
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    });

    realtime.start(token);

    return () => {
      offStatus();
      offQuote();
      offOrder();
      realtime.stop();
    };
  }, [token, queryClient]);
}

/** Live quotes for these symbols while the component is mounted */
export function useLiveSymbols(symbols: string[]) {
  // A string, so a new array with the same symbols doesn't resubscribe
  const key = symbols.join(',');

  useEffect(() => {
    if (!key) return;
    const releases = key.split(',').map((symbol) => realtime.subscribe(symbol));
    return () => releases.forEach((release) => release());
  }, [key]);
}
