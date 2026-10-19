/** Subset of expo-location's LocationGeocodedAddress that we rely on. */
export type GeocodedAddress = {
  name?: string | null;
  city: string | null;
  district: string | null;
  subregion: string | null;
  region: string | null;
  country: string | null;
  isoCountryCode: string | null;
};

/** What the phone suggests as the place. The server makes the final match in M2. */
export type SuggestedPlace = {
  name: string;
  locality: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Picks the most "place-like" name from a reverse-geocoded address.
 * In a city with districts, the district is the place ("Grünerløkka" in Oslo), so one big city
 * doesn't collapse into a single place. Otherwise the town (Zermatt), then broader areas for
 * remote spots. Returns null when the address holds nothing usable, e.g. in the middle of the ocean.
 */
export function suggestPlace(address: GeocodedAddress | null | undefined): SuggestedPlace | null {
  if (!address) return null;

  const city = clean(address.city);
  const district = clean(address.district);
  const locality = city ?? district ?? clean(address.subregion);
  const region = clean(address.region);
  const country = clean(address.country);
  const cityDistrict = city && district && district !== city ? district : null;
  const name = cityDistrict ?? locality ?? region ?? clean(address.name) ?? country;
  if (!name) return null;

  return {
    name,
    locality,
    region,
    country,
    countryCode: clean(address.isoCountryCode)?.toUpperCase() ?? null,
  };
}

/**
 * "Grünerløkka, Oslo" for a city district, otherwise "Zermatt, Switzerland".
 * Avoids repeating the name when it is the city or country itself.
 */
export function formatPlaceLabel(place: SuggestedPlace): string {
  if (place.locality && place.locality !== place.name) return `${place.name}, ${place.locality}`;
  if (!place.country || place.country === place.name) return place.name;
  return `${place.name}, ${place.country}`;
}

/** "46.0207° N, 7.7491° E". Fallback label when no place name is available. */
export function formatCoordinates(latitude: number, longitude: number): string {
  const lat = `${Math.abs(latitude).toFixed(4)}° ${latitude >= 0 ? 'N' : 'S'}`;
  const lng = `${Math.abs(longitude).toFixed(4)}° ${longitude >= 0 ? 'E' : 'W'}`;
  return `${lat}, ${lng}`;
}
