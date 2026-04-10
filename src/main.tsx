/**
 * main.tsx — React 18 entry point
 *
 * QueryClientProvider is required here so TanStack Query v5 is available
 * throughout the entire component tree.  Without this wrapper,
 * every useQuery / useMutation call throws:
 *   "No QueryClient set, use QueryClientProvider to set one"
 *
 * QueryClient configuration:
 *  - staleTime 5 min  → shared data (products, developers) is not re-fetched
 *                        every time a new panel mounts
 *  - gcTime    10 min → cached data is kept in memory for 10 min after
 *                        all consumers unmount (enables fast back-navigation)
 *  - retry 2          → transient network errors are retried automatically
 *  - refetchOnWindowFocus false → prevents surprise re-fetches when
 *                        the user Alt+Tabs back to the app
 */

import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            1000 * 60 * 5,    // 5 minutes
      gcTime:               1000 * 60 * 10,   // 10 minutes (replaces deprecated cacheTime)
      retry:                2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,   // mutations should not auto-retry — user can explicitly resubmit
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
