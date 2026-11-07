import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { getTransactions } from '../services/transactions.service';
import type { TransactionFilters } from '../services/types';

const PAGE_SIZE = 25;

/**
 * The trade history, newest first, one page at a time. Each page's
 * nextCursor fetches the next one ("Load more"); null = no more pages.
 * The filters are part of the key: changing them starts again at page 1.
 */
export function useTransactions(filters: TransactionFilters) {
  return useInfiniteQuery({
    queryKey: ['transactions', filters],
    queryFn: ({ pageParam }) =>
      getTransactions({ ...filters, cursor: pageParam, limit: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    // Keep the old rows on screen while a new filter loads (no flash)
    placeholderData: keepPreviousData,
  });
}
