import { createClient } from '@supabase/supabase-js';

import { ensureUserId } from '@/features/auth/session';
import { listMyPhotos, postPhotoAs } from '@/features/photos/api';
import { getPlace } from '@/features/places/api';
import { env } from '@/lib/env';
import { uuidv4 } from '@/lib/uuid';
import { samplePhoto } from './seed';

/**
 * Dev only: tests "new photo at a place you've been" with a single phone.
 * A second anonymous traveler signs in on a separate, in-memory Supabase client and posts a
 * sample photo at your most recent place. Your own session is never touched (signing it out
 * would revoke it on the server). The server then notifies *you*, since this device's token
 * belongs to your user.
 */
export async function simulateOtherTraveler(onProgress: (message: string) => void): Promise<string> {
  await ensureUserId();
  const [latest] = await listMyPhotos();
  if (!latest) throw new Error('Post a photo first, so there is a place of yours to post at.');
  const place = await getPlace(latest.placeId);

  onProgress('Preparing a sample photo…');
  const files = await samplePhoto(`visitor-${Date.now()}`);

  onProgress('Signing in a temporary second traveler…');
  const visitor = createClient(env.supabaseUrl, env.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await visitor.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error('Visitor sign-in returned no user.');

  onProgress(`Posting at ${place.name} as the other traveler…`);
  await postPhotoAs(visitor, data.user.id, {
    photoId: uuidv4(),
    takenAt: new Date().toISOString(),
    latitude: place.latitude,
    longitude: place.longitude,
    accuracy: 10,
    place: {
      name: place.name,
      locality: place.name,
      region: place.region,
      country: place.country,
      countryCode: null,
    },
    files,
  });
  return place.name;
}

/**
 * Dev only: three temporary anonymous travelers report your most recent photo, which should
 * reach the auto-hide threshold. Afterwards My Trips shows it as "Hidden" and it leaves the map.
 */
export async function simulateReports(onProgress: (message: string) => void): Promise<string> {
  await ensureUserId();
  const [latest] = await listMyPhotos();
  if (!latest) throw new Error('Post a photo first, so there is something to report.');

  let outcome = '';
  for (let i = 1; i <= 3; i++) {
    onProgress(`Reporter ${i}/3 is reporting your photo at ${latest.placeName}…`);
    const reporter = createClient(env.supabaseUrl, env.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error: signInError } = await reporter.auth.signInAnonymously();
    if (signInError) throw signInError;
    const { data, error } = await reporter.rpc('report_photo', {
      p_photo_id: latest.id,
      p_reason: 'other',
    });
    if (error) throw new Error(error.message);
    outcome = String(data);
  }
  return `${latest.placeName}: last report returned “${outcome}”.`;
}
