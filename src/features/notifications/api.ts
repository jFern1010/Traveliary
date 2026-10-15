import { ensureUserId } from '@/features/auth/session';
import { supabase } from '@/lib/supabase';

/** Links this device's Expo push token to the current (anonymous) user. Safe to call repeatedly. */
export async function savePushToken(token: string): Promise<void> {
  await ensureUserId();
  const { error } = await supabase.rpc('register_push_token', { p_token: token });
  if (error) throw new Error(error.message);
}
