import { Directory, File, Paths } from 'expo-file-system';
import { AppState } from 'react-native';

import { lookUpPlace, type CaptureLocation } from '@/features/capture/capture-location';
import type { ProcessedPhoto } from '@/features/capture/process-image';
import { postPhoto } from '@/features/photos/api';
import { isOnlineNow, onReconnect } from '@/lib/connectivity';
import * as db from './db';
import type { QueueItem } from './db';
import { afterFailure, afterManualRetry, afterReconnect, isDue } from './queue-state';

// ---------------------------------------------------------------------------
// Files: kept in the documents folder (not cache) so iOS never purges a queued photo.
// Only file *names* are stored, because the app's absolute container path can change.
// ---------------------------------------------------------------------------

function queueDir(): Directory {
  const dir = new Directory(Paths.document, 'upload-queue');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export function queueFile(name: string): File {
  return new File(queueDir(), name);
}

function deleteFiles(item: QueueItem) {
  for (const name of [item.fullFile, item.thumbFile]) {
    const file = queueFile(name);
    if (file.exists) file.delete();
  }
}

// ---------------------------------------------------------------------------
// In-memory snapshot for the UI (useSyncExternalStore)
// ---------------------------------------------------------------------------

let snapshot: QueueItem[] = [];
const listeners = new Set<() => void>();
const uploadedListeners = new Set<(photoId: string) => void>();

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): QueueItem[] {
  return snapshot;
}

/** Notified after each successful upload (used to refresh server data). */
export function onUploaded(listener: (photoId: string) => void): () => void {
  uploadedListeners.add(listener);
  return () => uploadedListeners.delete(listener);
}

async function refresh() {
  snapshot = await db.listItems();
  listeners.forEach((l) => l());
}

// ---------------------------------------------------------------------------
// Public actions
// ---------------------------------------------------------------------------

/** Saves a consented photo for upload. Returns once it is safely on disk; uploading happens in the background. */
export async function enqueue(draft: {
  id: string;
  takenAt: string;
  location: CaptureLocation;
  photo: ProcessedPhoto;
}): Promise<void> {
  const fullFile = `${draft.id}.jpg`;
  const thumbFile = `${draft.id}_thumb.jpg`;
  await new File(draft.photo.full.uri).copy(queueFile(fullFile));
  await new File(draft.photo.thumb.uri).copy(queueFile(thumbFile));

  await db.insertItem({
    id: draft.id,
    createdAt: Date.now(),
    takenAt: draft.takenAt,
    latitude: draft.location.latitude,
    longitude: draft.location.longitude,
    accuracy: draft.location.accuracy,
    place: draft.location.place,
    fullFile,
    fullWidth: draft.photo.full.width,
    fullHeight: draft.photo.full.height,
    thumbFile,
    thumbWidth: draft.photo.thumb.width,
    thumbHeight: draft.photo.thumb.height,
    status: 'pending',
    attempts: 0,
    nextAttemptAt: Date.now(),
    lastError: null,
  });
  await refresh();
  void kick();
}

export async function retry(id: string): Promise<void> {
  const item = snapshot.find((i) => i.id === id);
  if (!item || item.status === 'uploading') return;
  await db.updateTiming(id, afterManualRetry(item, Date.now()));
  await refresh();
  void kick();
}

/** Discards a queued photo that was never uploaded. */
export async function remove(id: string): Promise<void> {
  const item = snapshot.find((i) => i.id === id);
  if (!item || item.status === 'uploading') return;
  await db.deleteItem(id);
  deleteFiles(item);
  await refresh();
}

// ---------------------------------------------------------------------------
// Runner: one upload at a time.
// ---------------------------------------------------------------------------

let running = false;
let runAgain = false;
let timer: ReturnType<typeof setTimeout> | null = null;

async function uploadOne(item: QueueItem) {
  let place = item.place;
  if (!place) {
    // Captured offline: we're online now, so try naming the place before the server sees it.
    place = await lookUpPlace(item.latitude, item.longitude);
    if (place) await db.updatePlace(item.id, place);
  }

  await postPhoto({
    photoId: item.id,
    takenAt: item.takenAt,
    latitude: item.latitude,
    longitude: item.longitude,
    accuracy: item.accuracy,
    place,
    files: {
      full: { uri: queueFile(item.fullFile).uri, width: item.fullWidth, height: item.fullHeight },
      thumb: { uri: queueFile(item.thumbFile).uri, width: item.thumbWidth, height: item.thumbHeight },
    },
  });
}

/** Schedules the next run for the earliest backed-off item, so retries happen without a trigger. */
function scheduleNext() {
  if (timer) clearTimeout(timer);
  timer = null;
  const waiting = snapshot.filter((i) => i.status === 'pending');
  if (waiting.length === 0) return;
  const next = Math.min(...waiting.map((i) => i.nextAttemptAt));
  timer = setTimeout(() => void kick(), Math.max(0, next - Date.now()) + 250);
}

/** Uploads every due item. Safe to call any time; overlapping calls coalesce into one extra pass. */
export async function kick(): Promise<void> {
  if (running) {
    runAgain = true;
    return;
  }
  running = true;
  try {
    do {
      runAgain = false;
      // Offline: don't burn retry attempts; the reconnect listener will kick us.
      if (!(await isOnlineNow())) break;

      const due = snapshot.filter((i) => isDue(i, Date.now()));
      for (const item of due) {
        await db.updateTiming(item.id, { ...item, status: 'uploading' });
        await refresh();
        try {
          await uploadOne(item);
          await db.deleteItem(item.id);
          deleteFiles(item);
          await refresh();
          uploadedListeners.forEach((l) => l(item.id));
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          await db.updateTiming(item.id, afterFailure(item, message, Date.now()));
          await refresh();
        }
      }
    } while (runAgain);
  } finally {
    running = false;
    scheduleNext();
  }
}

let started = false;

/** Call once at app start: recovers interrupted uploads and listens for reconnects/foregrounding. */
export async function startQueue(): Promise<void> {
  if (started) return;
  started = true;
  await db.resetInFlight();
  await refresh();

  onReconnect(async () => {
    const now = Date.now();
    await Promise.all(snapshot.map((item) => db.updateTiming(item.id, afterReconnect(item, now))));
    await refresh();
    void kick();
  });
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void kick();
  });

  void kick();
}
