export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type Bounds = { minLat: number; minLng: number; maxLat: number; maxLng: number };

/** Wraps a longitude into [-180, 180). */
function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

/**
 * Converts the visible map region to query bounds, padded by 25% so small pans don't refetch,
 * and snapped to a grid so nearby regions share a cache entry.
 * When the view crosses the antimeridian, minLng > maxLng (the server handles that case).
 */
export function regionToBounds(region: Region): Bounds {
  const latPad = region.latitudeDelta * 0.75;
  const lngPad = region.longitudeDelta * 0.75;
  // Grid size grows with zoom level: ~1/8 of the visible span, at least 0.01°.
  const step = Math.max(0.01, Math.min(region.latitudeDelta, region.longitudeDelta) / 8);
  const snapDown = (v: number) => Math.floor(v / step) * step;
  const snapUp = (v: number) => Math.ceil(v / step) * step;
  const round = (v: number) => Number(v.toFixed(5));

  const minLat = round(Math.max(-90, snapDown(region.latitude - latPad)));
  const maxLat = round(Math.min(90, snapUp(region.latitude + latPad)));

  if (region.longitudeDelta * 2.5 >= 360) {
    return { minLat, maxLat, minLng: -180, maxLng: 180 };
  }
  return {
    minLat,
    maxLat,
    minLng: round(wrapLng(snapDown(region.longitude - lngPad))),
    maxLng: round(wrapLng(snapUp(region.longitude + lngPad))),
  };
}

/** "350 m", "4.2 km", "38 km". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** "12 photos" / "1 photo". */
export function formatPhotoCount(count: number): string {
  return `${count} ${count === 1 ? 'photo' : 'photos'}`;
}
