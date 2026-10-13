import { QueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../hooks/useAuthStore';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Serve cached data for 30s before refetching in the background
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // A 4xx (expired token, not found, validation) won't fix itself by
        // retrying. Network errors and 5xx get two more tries.
        const status = axios.isAxiosError(error)
          ? error.response?.status
          : undefined;
        if (status !== undefined && status < 500) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});

// On logout (button or expired token), drop every cached response, so the
// next user who logs in on this browser never sees the previous user's data
useAuthStore.subscribe((state, previous) => {
  if (previous.token && !state.token) {
    queryClient.clear();
  }
});
