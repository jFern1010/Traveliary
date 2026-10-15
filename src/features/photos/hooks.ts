import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { isBackendConfigured } from '@/lib/env';
import { deleteMyPhoto, getPhoto, listMyPhotos, listPlacePhotos } from './api';

export const photoKeys = {
  all: ['photos'] as const,
  mine: ['photos', 'mine'] as const,
  place: (placeId: string) => ['photos', 'place', placeId] as const,
  detail: (photoId: string) => ['photos', 'detail', photoId] as const,
};

export function useMyPhotos() {
  return useQuery({
    queryKey: photoKeys.mine,
    queryFn: listMyPhotos,
    enabled: isBackendConfigured,
  });
}

export function usePlacePhotos(placeId: string) {
  return useInfiniteQuery({
    queryKey: photoKeys.place(placeId),
    queryFn: ({ pageParam }) => listPlacePhotos(placeId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: isBackendConfigured,
  });
}

export function usePhoto(photoId: string) {
  return useQuery({
    queryKey: photoKeys.detail(photoId),
    queryFn: () => getPhoto(photoId),
    enabled: isBackendConfigured,
  });
}

/** Deleting changes galleries, counts and map pins, so refresh all of them. */
function useInvalidateAfterChange() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: photoKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['places'] }),
    ]);
}

export function useDeleteMyPhoto() {
  const invalidate = useInvalidateAfterChange();
  return useMutation({ mutationFn: deleteMyPhoto, onSuccess: invalidate });
}
