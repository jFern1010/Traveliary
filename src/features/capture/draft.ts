import type { EditState } from '@/features/editor/edit-state';
import { uuidv4 } from '@/lib/uuid';

import { getCaptureLocation, type CaptureLocation } from './capture-location';
import { processPhoto, type ProcessedPhoto } from './process-image';

/**
 * A photo that has been taken but not yet posted.
 * Location and processing start the instant the shutter is pressed, so the GPS fix
 * belongs to the moment of capture; the preview screen awaits both.
 */
export type CaptureDraft = {
  /** Becomes the photo ID on the server; reused on retry so a post is never duplicated. */
  id: string;
  /** Device time of the shutter press (ISO 8601). */
  takenAt: string;
  previewUri: string;
  previewAspectRatio: number;
  location: Promise<CaptureLocation>;
  /** The capture, resized to upload size. Always the source for editing, so re-edits never degrade. */
  photo: Promise<ProcessedPhoto>;
  /** Set when the user edited the photo; posting uses this instead of `photo`. */
  edited: { photo: ProcessedPhoto; edits: EditState } | null;
};

let current: CaptureDraft | null = null;
const listeners = new Set<() => void>();

/** For useSyncExternalStore: the preview re-renders when an edit is applied. */
export function subscribeDraft(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((l) => l());
}

export function startDraft(picture: { uri: string; width: number; height: number }): CaptureDraft {
  const location = getCaptureLocation();
  const photo = processPhoto(picture.uri, { width: picture.width, height: picture.height });
  // Avoid "unhandled rejection" warnings if the user discards before the preview awaits these.
  location.catch(() => {});
  photo.catch(() => {});

  current = {
    id: uuidv4(),
    takenAt: new Date().toISOString(),
    previewUri: picture.uri,
    previewAspectRatio: picture.width / picture.height,
    location,
    photo,
    edited: null,
  };
  emit();
  return current;
}

export function getDraft(): CaptureDraft | null {
  return current;
}

export function clearDraft() {
  current = null;
  emit();
}

/** Stores (or, with null, removes) the edited version of the draft with the given id. */
export function setDraftEdit(draftId: string, edited: CaptureDraft['edited']) {
  if (!current || current.id !== draftId) return;
  current = { ...current, edited };
  emit();
}
