import { QueryClient } from '@tanstack/react-query';

/**
 * Central QueryClient factory (P3 — TanStack Query migration).
 *
 * Defaults:
 * - staleTime 60s: pages/index.tsx remounts tab content on every tab switch;
 *   within a minute the cached data is reused instead of refetching.
 * - retry 1: single retry on failed fetches.
 * - refetchOnWindowFocus false: the app has its own explicit refresh pattern
 *   (components call the hooks' refresh* functions after mutations).
 *
 * Exported as a factory so tests can create isolated clients.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}
