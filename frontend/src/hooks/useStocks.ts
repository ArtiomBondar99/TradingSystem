import { useQuery } from '@tanstack/react-query';
import { getStocks } from '../services/stocks.service';

export function useStocks() {
  return useQuery({
    queryKey: ['stocks'],
    queryFn: getStocks,
    // The backend refreshes prices every 5s (WebSocket push in 3.4)
    refetchInterval: 10_000,
  });
}
