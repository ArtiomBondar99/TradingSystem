import { useQuery } from '@tanstack/react-query';
import { getPortfolio } from '../services/portfolio.service';

// Used by the header (cash) and the dashboard (everything). Both share the
// same query key, so TanStack Query sends ONE request and caches it for both.
export function usePortfolio() {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: getPortfolio,
  });
}
