import * as Location from 'expo-location';

import { suggestPlace, type SuggestedPlace } from './place-name';

export type CaptureLocation = {
  latitude: number;
  longitude: number;
  /** Horizontal accuracy radius in meters, if the device reports one. */
  accuracy: number | null;
  /** Null when reverse geocoding failed (e.g. offline). The server can still resolve it later. */
  place: SuggestedPlace | null;
};

const FIX_TIMEOUT_MS = 10_000;
/** A last-known fix this recent still counts as "taken here". */
const LAST_KNOWN_MAX_AGE_MS = 2 * 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out getting your location.')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function getFix(): Promise<Location.LocationObject> {
  try {
    return await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      FIX_TIMEOUT_MS,
    );
  } catch (error) {
    // Weak GPS (indoors, tunnels): accept a very recent fix rather than failing the capture.
    const lastKnown = await Location.getLastKnownPositionAsync({
      maxAge: LAST_KNOWN_MAX_AGE_MS,
    });
    if (lastKnown) return lastKnown;
    throw error;
  }
}

/** Asks the phone's geocoder which place a point is in. Null when offline or nothing usable is found. */
export async function lookUpPlace(latitude: number, longitude: number): Promise<SuggestedPlace | null> {
  try {
    const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
    return suggestPlace(address);
  } catch {
    return null;
  }
}

/** Reads GPS at the moment of capture and asks the phone's geocoder which place that is. */
export async function getCaptureLocation(): Promise<CaptureLocation> {
  const { coords } = await getFix();
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy ?? null,
    place: await lookUpPlace(coords.latitude, coords.longitude),
  };
}
