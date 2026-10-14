import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { isBackendConfigured } from '@/lib/env';
import { deleteMyPhoto, listMyPhotos, postPhoto } from './api';

export const photoKeys = {
  mine: ['photos', 'mine'] as const,
};

export function useMyPhotos() {
  return useQuery({
    queryKey: photoKeys.mine,
    queryFn: listMyPhotos,
    enabled: isBackendConfigured,
  });
}

export function usePostPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postPhoto,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: photoKeys.mine }),
  });
}

export function useDeleteMyPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteMyPhoto,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: photoKeys.mine }),
  });
}
