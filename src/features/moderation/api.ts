import { useMutation, useQueryClient } from '@tanstack/react-query';

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
