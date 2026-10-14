import { ensureUserId } from '@/features/auth/session';
import { PHOTO_BUCKET, supabase } from '@/lib/supabase';
import type { Bounds } from './geo';

export type PlaceSummary = {
  id: string;
  name: string;
  country: string | null;
  latitude: number;
  longitude: number;
  photoCount: number;
  lastPhotoAt: string | null;
  coverThumbUrl: string | null;
  /** Only set by `placesNear`. */
  distanceMeters?: number;
};

type PlaceRow = {
  id: string;
  name: string;
  country: string | null;
  lat: number;
  lng: number;
  photo_count: number;
  last_photo_at: string | null;
  cover_thumb_path: string | null;
  distance_m?: number;
};

function toSummary(row: PlaceRow): PlaceSummary {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    latitude: row.lat,
    longitude: row.lng,
    photoCount: row.photo_count,
    lastPhotoAt: row.last_photo_at,
    coverThumbUrl: row.cover_thumb_path
      ? supabase.storage.from(PHOTO_BUCKET).getPublicUrl(row.cover_thumb_path).data.publicUrl
      : null,
    distanceMeters: row.distance_m,
  };
}

export async function placesInBounds(bounds: Bounds): Promise<PlaceSummary[]> {
  await ensureUserId();
  const { data, error } = await supabase
    .rpc('places_in_bounds', {
      p_min_lat: bounds.minLat,
      p_min_lng: bounds.minLng,
      p_max_lat: bounds.maxLat,
      p_max_lng: bounds.maxLng,
      p_limit: 200,
    });
  if (error) throw new Error(error.message);
  return ((data ?? []) as PlaceRow[]).map(toSummary);
}

export async function placesNear(
  latitude: number,
  longitude: number,
  radiusMeters = 50_000,
): Promise<PlaceSummary[]> {
  await ensureUserId();
  const { data, error } = await supabase
    .rpc('places_near', { p_lat: latitude, p_lng: longitude, p_radius_m: radiusMeters, p_limit: 50 });
  if (error) throw new Error(error.message);
  return ((data ?? []) as PlaceRow[]).map(toSummary);
}

export type PlaceDetail = {
  id: string;
  name: string;
  region: string | null;
  country: string | null;
  photoCount: number;
  lastPhotoAt: string | null;
};

export async function getPlace(placeId: string): Promise<PlaceDetail> {
  await ensureUserId();
  const { data, error } = await supabase
    .from('places')
    .select('id, name, region, country, photo_count, last_photo_at')
    .eq('id', placeId)
    .single<{
      id: string;
      name: string;
      region: string | null;
      country: string | null;
      photo_count: number;
      last_photo_at: string | null;
    }>();
  if (error) throw new Error(error.message);
  return {
    id: data.id,
    name: data.name,
    region: data.region,
    country: data.country,
    photoCount: data.photo_count,
    lastPhotoAt: data.last_photo_at,
  };
}
