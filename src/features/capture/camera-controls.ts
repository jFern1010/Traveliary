export type FlashMode = 'off' | 'auto' | 'on';

/** Flash button cycles off → auto → on → off. */
export function nextFlash(mode: FlashMode): FlashMode {
  return mode === 'off' ? 'auto' : mode === 'auto' ? 'on' : 'off';
}

/**
 * New camera zoom (0–1, expo-camera's scale) after a pinch.
 *
 * expo-camera maps 0–1 differently per platform, and neither exposes the phone's max zoom:
 *   iOS:     magnification = maxZoom ^ zoom   (exponential, so equal pinch steps feel even)
 *   Android: magnification = zoom × maxZoom   (linear, floored at 1×)
 * So we add log(scale) on iOS and multiply on Android, each tuned for typical phones
 * (iOS max ≈ 16×, Android max ≈ 8×), making a pinch feel the same on both.
 */
export function nextZoom(startZoom: number, pinchScale: number, os: string | undefined): number {
  const scale = Math.max(pinchScale, 0.01);
  let zoom: number;
  if (os === 'ios') {
    zoom = startZoom + Math.log(scale) / Math.log(16);
  } else {
    // Below 1/8 everything is 1× on Android, so start pinches from the 1× point.
    zoom = Math.max(startZoom, 1 / 8) * scale;
    if (zoom <= 1 / 8) zoom = 0;
  }
  return Math.min(1, Math.max(0, zoom));
}

/**
 * The ultra-wide (0.5×) lens among iOS back-camera lens names, if any.
 * iOS lens names are localized; we recognize the English name ("Back Ultra Wide Camera"),
 * so on other languages the 0.5× button simply doesn't appear.
 */
export function findUltraWideLens(lenses: string[]): string | null {
  return lenses.find((l) => /ultra\s*wide/i.test(l)) ?? null;
}
