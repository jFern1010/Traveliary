import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { isBackendConfigured } from '@/lib/env';
import { getPlace, placesInBounds, placesNear } from './api';
import type { Bounds } from './geo';

export const placeKeys = {
  bounds: (b: Bounds) => ['places', 'bounds', b.minLat, b.minLng, b.maxLat, b.maxLng] as const,
  near: (lat: number, lng: number) => ['places', 'near', lat, lng] as const,
  detail: (placeId: string) => ['places', 'detail', placeId] as const,
};

/** Places with photos inside the map view. Keeps the previous pins while the next set loads. */
export function usePlacesInBounds(bounds: Bounds | null) {
  return useQuery({
    queryKey: bounds ? placeKeys.bounds(bounds) : ['places', 'bounds', 'none'],
    queryFn: () => placesInBounds(bounds!),
    enabled: isBackendConfigured && bounds !== null,
    placeholderData: keepPreviousData,
  });
}

/** Places near a position. Coordinates are rounded (~100 m) so tiny GPS jitter reuses the cache. */
export function usePlacesNear(position: { latitude: number; longitude: number } | null) {
  const lat = position ? Number(position.latitude.toFixed(3)) : 0;
  const lng = position ? Number(position.longitude.toFixed(3)) : 0;
  return useQuery({
    queryKey: placeKeys.near(lat, lng),
    queryFn: () => placesNear(lat, lng),
    enabled: isBackendConfigured && position !== null,
  });
}

export function usePlace(placeId: string) {
  return useQuery({
    queryKey: placeKeys.detail(placeId),
    queryFn: () => getPlace(placeId),
    enabled: isBackendConfigured,
  });
}
