import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';

// The app's providers (TanStack Query + router), for tests. Only a component
// in this file: mixing components and functions breaks Fast Refresh.
export function TestProviders({
  client,
  route = '/',
  children,
}: {
  client: QueryClient;
  route?: string;
  children: ReactNode;
}) {
  return (
    <QueryClientProvider client={client}>
      {/* An in-memory router: the URL lives in the test, not a browser */}
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}
