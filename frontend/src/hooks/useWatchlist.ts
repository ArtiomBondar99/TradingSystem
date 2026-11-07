import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {
  addToWatchlist,
  getWatchlist,
  removeFromWatchlist,
} from '../services/watchlist.service';
import type { Stock, WatchlistItem } from '../services/types';

const WATCHLIST_KEY = ['watchlist'];

// Prices arrive over the WebSocket (useRealtime patches this cache), so
// there is no polling here
export function useWatchlist() {
  return useQuery({ queryKey: WATCHLIST_KEY, queryFn: getWatchlist });
}

/**
 * Add or remove one stock. Optimistic: the star and the list change at once,
 * before the server answers; on an error they go back to how they were.
 */
export function useToggleWatchlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ symbol, watched }: { symbol: string; watched: boolean }) =>
      watched ? removeFromWatchlist(symbol) : addToWatchlist(symbol),

    onMutate: async ({ symbol, watched }) => {
      // A refetch landing now would overwrite the optimistic list
      await queryClient.cancelQueries({ queryKey: WATCHLIST_KEY });
      const previous = queryClient.getQueryData<WatchlistItem[]>(WATCHLIST_KEY);

      queryClient.setQueryData<WatchlistItem[]>(WATCHLIST_KEY, (items = []) =>
        watched
          ? items.filter((item) => item.symbol !== symbol)
          : [...items, placeholderItem(queryClient, symbol)],
      );

      return { previous };
    },

    onError: (_error, _variables, context) => {
      queryClient.setQueryData(WATCHLIST_KEY, context?.previous);
    },

    // Success or not, take the server's version (real change %, order)
    onSettled: () => queryClient.invalidateQueries({ queryKey: WATCHLIST_KEY }),
  });
}

/** Is this stock on the user's watchlist? */
export function useIsWatched(symbol: string): boolean {
  const { data } = useWatchlist();
  return data?.some((item) => item.symbol === symbol) ?? false;
}

// The row shown until the server answers, from the stocks we already have
function placeholderItem(
  queryClient: QueryClient,
  symbol: string,
): WatchlistItem {
  const stock = queryClient
    .getQueryData<Stock[]>(['stocks'])
    ?.find((s) => s.symbol === symbol);

  return {
    symbol,
    name: stock?.name ?? symbol,
    currentPrice: stock?.currentPrice ?? '0',
    change: null,
    changePercent: null,
    addedAt: new Date().toISOString(),
  };
}
