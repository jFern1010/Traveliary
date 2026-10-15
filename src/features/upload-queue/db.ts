import * as SQLite from 'expo-sqlite';

import type { SuggestedPlace } from '@/features/capture/place-name';
import type { QueueStatus, QueueTiming } from './queue-state';

/** A consented photo waiting to be uploaded. Files are stored by name inside the queue folder. */
export type QueueItem = QueueTiming & {
  /** Also the server-side photo ID, so retries are idempotent. */
  id: string;
  createdAt: number;
  takenAt: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  place: SuggestedPlace | null;
  fullFile: string;
  fullWidth: number;
  fullHeight: number;
  thumbFile: string;
  thumbWidth: number;
  thumbHeight: number;
};

type Row = {
  id: string;
  created_at: number;
  taken_at: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  place_json: string | null;
  full_file: string;
  full_width: number;
  full_height: number;
  thumb_file: string;
  thumb_width: number;
  thumb_height: number;
  status: QueueStatus;
  attempts: number;
  next_attempt_at: number;
  last_error: string | null;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= (async () => {
    const db = await SQLite.openDatabaseAsync('upload-queue.db');
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS upload_queue (
        id              TEXT PRIMARY KEY NOT NULL,
        created_at      INTEGER NOT NULL,
        taken_at        TEXT NOT NULL,
        latitude        REAL NOT NULL,
        longitude       REAL NOT NULL,
        accuracy        REAL,
        place_json      TEXT,
        full_file       TEXT NOT NULL,
        full_width      INTEGER NOT NULL,
        full_height     INTEGER NOT NULL,
        thumb_file      TEXT NOT NULL,
        thumb_width     INTEGER NOT NULL,
        thumb_height    INTEGER NOT NULL,
        status          TEXT NOT NULL,
        attempts        INTEGER NOT NULL DEFAULT 0,
        next_attempt_at INTEGER NOT NULL,
        last_error      TEXT
      );
    `);
    return db;
  })();
  return dbPromise;
}

function fromRow(row: Row): QueueItem {
  return {
    id: row.id,
    createdAt: row.created_at,
    takenAt: row.taken_at,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy: row.accuracy,
    place: row.place_json ? (JSON.parse(row.place_json) as SuggestedPlace) : null,
    fullFile: row.full_file,
    fullWidth: row.full_width,
    fullHeight: row.full_height,
    thumbFile: row.thumb_file,
    thumbWidth: row.thumb_width,
    thumbHeight: row.thumb_height,
    status: row.status,
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt_at,
    lastError: row.last_error,
  };
}

export async function listItems(): Promise<QueueItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>('SELECT * FROM upload_queue ORDER BY created_at ASC');
  return rows.map(fromRow);
}

export async function insertItem(item: QueueItem): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO upload_queue (
       id, created_at, taken_at, latitude, longitude, accuracy, place_json,
       full_file, full_width, full_height, thumb_file, thumb_width, thumb_height,
       status, attempts, next_attempt_at, last_error
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    item.id,
    item.createdAt,
    item.takenAt,
    item.latitude,
    item.longitude,
    item.accuracy,
    item.place ? JSON.stringify(item.place) : null,
    item.fullFile,
    item.fullWidth,
    item.fullHeight,
    item.thumbFile,
    item.thumbWidth,
    item.thumbHeight,
    item.status,
    item.attempts,
    item.nextAttemptAt,
    item.lastError,
  );
}

export async function updateTiming(id: string, timing: QueueTiming): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE upload_queue SET status = ?, attempts = ?, next_attempt_at = ?, last_error = ? WHERE id = ?',
    timing.status,
    timing.attempts,
    timing.nextAttemptAt,
    timing.lastError,
    id,
  );
}

export async function updatePlace(id: string, place: SuggestedPlace): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE upload_queue SET place_json = ? WHERE id = ?', JSON.stringify(place), id);
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM upload_queue WHERE id = ?', id);
}

/** Items stuck in `uploading` belong to a previous app session that was killed mid-upload. */
export async function resetInFlight(): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE upload_queue SET status = 'pending' WHERE status = 'uploading'");
}
