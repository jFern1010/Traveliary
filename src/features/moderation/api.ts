import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ensureUserId } from '@/features/auth/session';
import { photoKeys } from '@/features/photos/hooks';
import { supabase } from '@/lib/supabase';
import type { ReportOutcome, ReportReason } from './reasons';

export async function reportPhoto(photoId: string, reason: ReportReason): Promise<ReportOutcome> {
  await ensureUserId();
  const { data, error } = await supabase.rpc('report_photo', { p_photo_id: photoId, p_reason: reason });
  if (error) throw new Error(error.message);
  return data as ReportOutcome;
}

/** Reporting removes the photo from the reporter's feeds, so galleries and pins must refresh. */
export function useReportPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ photoId, reason }: { photoId: string; reason: ReportReason }) =>
      reportPhoto(photoId, reason),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: photoKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['places'] }),
      ]),
  });
}

export async function blockPhotoAuthor(photoId: string): Promise<void> {
  await ensureUserId();
  const { error } = await supabase.rpc('block_photo_author', { p_photo_id: photoId });
  if (error) throw new Error(error.message);
}

export async function getBlockCount(): Promise<number> {
  await ensureUserId();
  const { data, error } = await supabase.rpc('my_block_count');
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function unblockAll(): Promise<number> {
  await ensureUserId();
  const { data, error } = await supabase.rpc('unblock_all');
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export const blockKeys = { count: ['blocks', 'count'] as const };

/** Blocking or unblocking changes what every feed shows, so refresh them all. */
function useRefreshFeeds() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: photoKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['places'] }),
      queryClient.invalidateQueries({ queryKey: blockKeys.count }),
    ]);
}

export function useBlockAuthor() {
  const refresh = useRefreshFeeds();
  return useMutation({ mutationFn: blockPhotoAuthor, onSuccess: refresh });
}

export function useBlockCount() {
  return useQuery({ queryKey: blockKeys.count, queryFn: getBlockCount });
}

export function useUnblockAll() {
  const refresh = useRefreshFeeds();
  return useMutation({ mutationFn: unblockAll, onSuccess: refresh });
}
