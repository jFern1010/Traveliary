import { useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';

export type CapturePermissionState =
  /** Still reading the current permission status. */
  | 'loading'
  /** At least one permission can still be asked for with the system prompt. */
  | 'ask'
  /** At least one permission was denied for good; only Settings can fix it. */
  | 'blocked'
  | 'granted';

type Response = { granted: boolean; canAskAgain: boolean } | null;

function combine(camera: Response, location: Response): CapturePermissionState {
  if (!camera || !location) return 'loading';
  if (camera.granted && location.granted) return 'granted';
  const blocked = [camera, location].some((p) => !p.granted && !p.canAskAgain);
  return blocked ? 'blocked' : 'ask';
}

/** Camera and location are both required: a photo is only meaningful with the place it was taken. */
export function useCapturePermissions() {
  const [camera, requestCamera] = useCameraPermissions();
  const [location, requestLocation] = Location.useForegroundPermissions();

  async function request() {
    if (!camera?.granted) await requestCamera();
    if (!location?.granted) await requestLocation();
  }

  return {
    state: combine(camera, location),
    cameraGranted: camera?.granted ?? false,
    locationGranted: location?.granted ?? false,
    request,
  };
}
