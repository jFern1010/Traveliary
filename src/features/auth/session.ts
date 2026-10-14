import { isBackendConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';

let pending: Promise<string> | null = null;

async function signIn(): Promise<string> {
  if (!isBackendConfigured) {
    throw new Error('Backend not configured. Add your Supabase keys to .env.local and restart.');
  }
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;

  // No profiles in v1: each install gets a stable anonymous identity, upgradeable to an account later.
  const { data: signedIn, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!signedIn.user) throw new Error('Anonymous sign-in returned no user.');
  return signedIn.user.id;
}

/** Returns this device's user ID, signing in anonymously on first use. Concurrent callers share one sign-in. */
export function ensureUserId(): Promise<string> {
  pending ??= signIn().finally(() => {
    pending = null;
  });
  return pending;
}
