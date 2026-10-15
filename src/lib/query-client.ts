import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Keep data around as long as it is persisted, so viewed places stay browsable offline.
      gcTime: WEEK_MS,
      retry: 2,
    },
  },
});

/** Saves successful query results to the phone so previously viewed places work without signal. */
export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: createAsyncStoragePersister({
    storage: AsyncStorage,
    key: 'traveliary-query-cache',
    throttleTime: 2_000,
  }),
  maxAge: WEEK_MS,
  // Bump when cached data shapes change, to discard incompatible caches.
  buster: 'v1',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => query.state.status === 'success',
  },
};
