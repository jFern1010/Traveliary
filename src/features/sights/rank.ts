/** A sight as returned by the nearby-sights Edge Function. */
export type Sight = {
  id: string;
  name: string;
  description: string | null;
  lat: number;
  lng: number;
  /** Wikipedia language editions with an article: how famous the place is. */
  fame: number;
  imageUrl: string | null;
  wikiLang: string | null;
  wikiTitle: string | null;
  /** Visible Traveliary photos within 300 m. */
  travelerPhotos: number;
};

export type RankedSight = Sight & { distanceKm: number; score: number };

export const MAX_DISTANCE_KM = 50;
export const MAX_RESULTS = 30;

/** Great-circle distance in km (haversine). */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * fame (log of Wikipedia editions) + Traveliary activity (log of photos) − distance penalty.
 * Logs keep a 200-language landmark from drowning everything; the penalty means a famous place
 * 45 km away must be much more famous than one around the corner to rank above it.
 */
export function scoreSight(fame: number, travelerPhotos: number, km: number): number {
  return Math.log2(1 + fame) + 0.7 * Math.log2(1 + travelerPhotos) - 3 * (km / MAX_DISTANCE_KM);
}

/** Filters to MAX_DISTANCE_KM around the user and returns the best MAX_RESULTS, best first. */
export function rankSights(
  sights: Sight[],
  position: { latitude: number; longitude: number },
  { maxKm = MAX_DISTANCE_KM, limit = MAX_RESULTS } = {},
): RankedSight[] {
  return sights
    .map((s) => {
      const km = distanceKm(position.latitude, position.longitude, s.lat, s.lng);
      return { ...s, distanceKm: km, score: scoreSight(s.fame, s.travelerPhotos, km) };
    })
    .filter((s) => s.distanceKm <= maxKm)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Wikipedia article URL for a sight, if it has one. */
export function wikipediaUrl(sight: Pick<Sight, 'wikiLang' | 'wikiTitle'>): string | null {
  if (!sight.wikiLang || !sight.wikiTitle) return null;
  return `https://${sight.wikiLang}.m.wikipedia.org/wiki/${encodeURIComponent(sight.wikiTitle.replace(/ /g, '_'))}`;
}
