import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // Keep data fresh for 5 minutes
      gcTime: 30 * 60 * 1000,        // Keep unused data in cache for 30 minutes
      refetchOnWindowFocus: false,   // Don't refetch every time the user switches tabs
      retry: 2,                      // If an API call fails, try 2 more times automatically
      refetchOnReconnect: "always",
    },
  },
});