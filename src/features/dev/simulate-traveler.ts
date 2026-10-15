import { ensureUserId } from '@/features/auth/session';
import { listMyPhotos, postPhoto } from '@/features/photos/api';
import { getPlace } from '@/features/places/api';
import { supabase } from '@/lib/supabase';
import { uuidv4 } from '@/lib/uuid';
import { samplePhoto } from './seed';

/**
 * Dev only: tests "new photo at a place you've been" with a single phone.
 * Temporarily signs in as a second anonymous traveler, posts a sample photo at your most recent
 * place, then restores your own session. The server then notifies *you* (this device's token
 * belongs to your user).
 */
export async function simulateOtherTraveler(onProgress: (message: string) => void): Promise<string> {
  await ensureUserId();
  const [latest] = await listMyPhotos();
  if (!latest) throw new Error('Post a photo first, so there is a place of yours to post at.');
  const place = await getPlace(latest.placeId);

  onProgress('Preparing a sample photo…');
  const files = await samplePhoto(`visitor-${Date.now()}`);

  const { data } = await supabase.auth.getSession();
  const mine = data.session;
  if (!mine) throw new Error('No session to restore afterwards.');

  try {
    onProgress('Signing in as another traveler…');
    await supabase.auth.signOut({ scope: 'local' });
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw error;

    onProgress(`Posting at ${place.name} as the other traveler…`);
    await postPhoto({
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
  } finally {
    onProgress('Switching back to you…');
    await supabase.auth.signOut({ scope: 'local' });
    const { error } = await supabase.auth.setSession({
      access_token: mine.access_token,
      refresh_token: mine.refresh_token,
    });
    if (error) throw new Error(`Could not restore your session: ${error.message}`);
  }
  return place.name;
}
