import { useQuery } from '@tanstack/react-query';
import { getStocks } from '../services/stocks.service';
import { useIsLive } from './useRealtimeStore';

export function useStocks() {
  const live = useIsLive();
  return useQuery({
    queryKey: ['stocks'],
    queryFn: getStocks,
    // Live: prices arrive over the WebSocket; the rare refetch only catches
    // anything missed. Otherwise poll.
    refetchInterval: live ? 60_000 : 10_000,
  });
}
