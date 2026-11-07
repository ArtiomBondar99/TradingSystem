import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { TestProviders } from './TestProviders';

// A fresh cache per test: no data leaks between tests. No retries, so a
// failing request fails the test at once instead of after 3 attempts.
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

/** render() with the app's providers (TanStack Query + router) */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', client = createTestQueryClient() } = {},
) {
  return {
    client,
    ...render(
      <TestProviders client={client} route={route}>
        {ui}
      </TestProviders>,
    ),
  };
}
