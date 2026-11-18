import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/ApiError';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      // ApiClient already retries network/5xx for GET; do not multiply attempts.
      retry: (count, err) => count < 1 && !(err instanceof ApiError && err.status >= 400 && err.status < 500),
    },
  },
});
