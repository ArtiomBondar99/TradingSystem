import { useQuery } from '@tanstack/react-query';
import { getStocks } from '../services/stocks.service';

export function useStocks() {
  return useQuery({
    queryKey: ['stocks'],
    queryFn: getStocks,
  });
}
