import { getCaptureLocation, type CaptureLocation } from './capture-location';
import { processPhoto, type ProcessedPhoto } from './process-image';

/**
 * A photo that has been taken but not yet posted.
 * Location and processing start the instant the shutter is pressed, so the GPS fix
 * belongs to the moment of capture; the preview screen awaits both.
 */
export type CaptureDraft = {
  id: string;
  /** Device time of the shutter press (ISO 8601). */
  takenAt: string;
  previewUri: string;
  previewAspectRatio: number;
  location: Promise<CaptureLocation>;
  photo: Promise<ProcessedPhoto>;
};

let current: CaptureDraft | null = null;

export function startDraft(picture: { uri: string; width: number; height: number }): CaptureDraft {
  const location = getCaptureLocation();
  const photo = processPhoto(picture.uri, { width: picture.width, height: picture.height });
  // Avoid "unhandled rejection" warnings if the user discards before the preview awaits these.
  location.catch(() => {});
  photo.catch(() => {});

  current = {
    id: `${Date.now()}`,
    takenAt: new Date().toISOString(),
    previewUri: picture.uri,
    previewAspectRatio: picture.width / picture.height,
    location,
    photo,
  };
  return current;
}

export function getDraft(): CaptureDraft | null {
  return current;
}

export function clearDraft() {
  current = null;
}
