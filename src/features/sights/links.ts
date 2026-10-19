/** Directions in the platform's own maps app. No API key needed. */
export function directionsUrl(os: string | undefined, lat: number, lng: number): string {
  const dest = `${lat},${lng}`;
  return os === 'ios'
    ? `https://maps.apple.com/?daddr=${dest}`
    : `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

/**
 * Commons file page (author and license) for an image URL like
 * ".../wiki/Special:FilePath/Oslo%20Opera.jpg?width=640". Used for the photo credit link.
 */
export function commonsFilePage(imageUrl: string | null): string | null {
  const name = imageUrl?.match(/Special:FilePath\/([^?]+)/)?.[1];
  return name ? `https://commons.wikimedia.org/wiki/File:${name}` : null;
}

/** "350 m" / "4.2 km" / "38 km" from kilometers. */
export function formatKm(km: number): string {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}
