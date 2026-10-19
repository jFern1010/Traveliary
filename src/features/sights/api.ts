import { ensureUserId } from '@/features/auth/session';
import { toPhoto, type Photo, type PhotoPublicRow } from '@/features/photos/api';
import { supabase } from '@/lib/supabase';
import { cellFor } from '../../../supabase/functions/nearby-sights/sights';
import type { Sight } from './rank';

const WIKI_USER_AGENT = 'Traveliary/0.9 (jonnelbfernandez@gmail.com)';

/** The phone's language for sight names ("nb-NO" → sent as is; the server normalizes it). */
export function deviceLanguage(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'en';
  } catch {
    return 'en';
  }
}

export type NearbySightsResponse = { cell: string; source: 'wikidata' | 'wikipedia'; sights: Sight[] };

/**
 * Sights around a position. Only the ~11 km cell center leaves the phone, never the exact position
 * (the Privacy Policy promises this). Can take up to ~30 s in a new area.
 */
export async function fetchNearbySights(latitude: number, longitude: number, lang: string): Promise<NearbySightsResponse> {
  await ensureUserId();
  const cell = cellFor(latitude, longitude);
  const { data, error } = await supabase.functions.invoke<NearbySightsResponse>('nearby-sights', {
    method: 'POST',
    body: { lat: cell.lat, lng: cell.lng, lang },
  });
  if (error) {
    const detail = await (error.context as Response | undefined)?.json?.().catch(() => null);
    throw new Error(detail?.error ?? 'Couldn’t load must-see places.');
  }
  if (!data) throw new Error('Couldn’t load must-see places.');
  return data;
}

export type SightSummary = { extract: string; pageUrl: string | null };

/** Short Wikipedia summary for the detail screen (Wikipedia's REST API, no key needed). */
export async function fetchSightSummary(wikiLang: string, wikiTitle: string): Promise<SightSummary> {
  const res = await fetch(
    `https://${wikiLang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle.replace(/ /g, '_'))}`,
    { headers: { 'Api-User-Agent': WIKI_USER_AGENT, Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  const body = (await res.json()) as { extract?: string; content_urls?: { mobile?: { page?: string } } };
  return { extract: body.extract ?? '', pageUrl: body.content_urls?.mobile?.page ?? null };
}

/** Visible Traveliary photos within 300 m of a sight, newest first. */
export async function photosNearSight(lat: number, lng: number): Promise<Photo[]> {
  await ensureUserId();
  const { data, error } = await supabase.rpc('photos_near_point', { p_lat: lat, p_lng: lng, p_radius_m: 300, p_limit: 30 });
  if (error) throw new Error(error.message);
  return ((data ?? []) as PhotoPublicRow[]).map(toPhoto);
}
