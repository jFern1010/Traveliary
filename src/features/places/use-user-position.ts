import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export type Position = { latitude: number; longitude: number };

/**
 * The user's approximate position for browsing (not for tagging photos).
 * Uses the cached fix first for a fast first paint, then a fresh balanced-accuracy fix.
 */
export function useUserPosition() {
  const [permission, requestPermission] = Location.useForegroundPermissions();
  const [position, setPosition] = useState<Position | null>(null);
  const granted = permission?.granted ?? false;

  useEffect(() => {
    if (!granted) return;
    let cancelled = false;
    const update = (loc: Location.LocationObject | null) => {
      if (!cancelled && loc) {
        setPosition({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    };
    (async () => {
      try {
        update(await Location.getLastKnownPositionAsync());
        update(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      } catch {
        // Browsing still works without a position; the map just starts zoomed out.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [granted]);

  return {
    position,
    granted,
    canAsk: permission ? permission.canAskAgain : true,
    requestPermission,
  };
}
