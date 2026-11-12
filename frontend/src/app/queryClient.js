import { QueryClient } from '@tanstack/react-query';

// Do not retry a request the server already answered with a client error (400, 403, 404 ...):
// asking again gives the same answer. Retry network problems and server errors twice.
function shouldRetry(failureCount, error) {
  const status = error?.response?.status;
  if (status && status < 500) return false;
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: shouldRetry,
    },
    mutations: {
      retry: false,
    },
  },
});
