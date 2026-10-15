import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';

import { photoKeys } from '@/features/photos/hooks';
import { getSnapshot, onUploaded, startQueue, subscribe } from './queue';

/** Photos waiting to upload, oldest first. Re-renders on every queue change. */
export function useUploadQueue() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Mount once near the app root: starts the queue and refreshes server data after each upload. */
export function useUploadQueueRunner() {
  const queryClient = useQueryClient();
  useEffect(() => {
    void startQueue();
    return onUploaded(() => {
      void queryClient.invalidateQueries({ queryKey: photoKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['places'] });
    });
  }, [queryClient]);
}
