import { formatCoordinates } from '@/features/capture/place-name';
import type { SuggestedPlace } from '@/features/capture/place-name';

/** Must match the paths `create_photo` derives on the server (see the init migration). */
export function photoStoragePaths(userId: string, photoId: string) {
  return {
    full: `${userId}/${photoId}.jpg`,
    thumb: `${userId}/${photoId}_thumb.jpg`,
  };
}

export type CreatePhotoInput = {
  photoId: string;
  takenAt: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  place: SuggestedPlace | null;
  width: number;
  height: number;
};

/** Arguments for the `create_photo` RPC. Without a geocoded name, the coordinates become the place name. */
export function buildCreatePhotoArgs(input: CreatePhotoInput) {
  const { place } = input;
  return {
    p_photo_id: input.photoId,
    p_lat: input.latitude,
    p_lng: input.longitude,
    p_accuracy_m: input.accuracy,
    p_taken_at: input.takenAt,
    p_place_name: place?.name ?? formatCoordinates(input.latitude, input.longitude),
    p_locality: place?.locality ?? null,
    p_region: place?.region ?? null,
    p_country: place?.country ?? null,
    p_country_code: place?.countryCode ?? null,
    p_width: input.width,
    p_height: input.height,
  };
}
