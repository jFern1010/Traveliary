import AsyncStorage from '@react-native-async-storage/async-storage';

import { ensureUserId } from '@/features/auth/session';
import { resetNotificationOffer } from '@/features/notifications/setup';
import { clearQueue } from '@/features/upload-queue/queue';
import { isOnlineNow } from '@/lib/connectivity';
import { persistOptions, queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';

/**
 * Permanently deletes this install's photos, reports, blocks, push token and anonymous identity
 * (server side, via the delete-account Edge Function), then resets the phone to a fresh state.
 * The next action signs in as a brand-new anonymous traveler.
 */
export async function deleteMyAccount(): Promise<void> {
  if (!(await isOnlineNow())) {
    throw new Error('You’re offline. Connect to the internet to delete your data.');
  }
  await ensureUserId();

  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) {
    // FunctionsHttpError carries the server's JSON message in `context`.
    const detail = await (error.context as Response | undefined)?.json?.().catch(() => null);
    throw new Error(detail?.error ?? error.message);
  }

  // Local cleanup. The server already revoked the identity, so a sign-out error is expected.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    // signOut keeps the session if the server answers unexpectedly; drop Supabase's stored session.
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token')));
  }
  await clearQueue();
  queryClient.clear();
  await persistOptions.persister.removeClient();
  await resetNotificationOffer();
}
