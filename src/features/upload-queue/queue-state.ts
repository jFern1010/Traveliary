/**
 * Upload queue state machine (pure: no storage, no network).
 *
 *   pending ──run──▶ uploading ──ok──▶ (removed from queue)
 *      ▲                 │
 *      └──retry later────┤ error, attempts < MAX_AUTO_ATTEMPTS (with backoff)
 *                        ▼
 *                     failed ──user taps Retry──▶ pending
 *
 * An item left in `uploading` (app killed mid-upload) is reset to `pending` on next launch.
 */
export type QueueStatus = 'pending' | 'uploading' | 'failed';

export type QueueTiming = {
  status: QueueStatus;
  attempts: number;
  /** Epoch ms; the runner skips the item until then. */
  nextAttemptAt: number;
  lastError: string | null;
};

export const MAX_AUTO_ATTEMPTS = 5;
const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 5 * 60_000;

/** 5 s, 10 s, 20 s, 40 s, … capped at 5 min. */
export function backoffMs(attempts: number): number {
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1));
}

export function isDue(item: QueueTiming, now: number): boolean {
  return item.status === 'pending' && item.nextAttemptAt <= now;
}

export function afterFailure(item: QueueTiming, error: string, now: number): QueueTiming {
  const attempts = item.attempts + 1;
  if (attempts >= MAX_AUTO_ATTEMPTS) {
    return { status: 'failed', attempts, nextAttemptAt: now, lastError: error };
  }
  return { status: 'pending', attempts, nextAttemptAt: now + backoffMs(attempts), lastError: error };
}

/** A manual retry starts fresh and runs immediately. */
export function afterManualRetry(item: QueueTiming, now: number): QueueTiming {
  return { ...item, status: 'pending', attempts: 0, nextAttemptAt: now };
}

/** Network changes (back online) make waiting items due right away instead of after their backoff. */
export function afterReconnect(item: QueueTiming, now: number): QueueTiming {
  return item.status === 'pending' ? { ...item, nextAttemptAt: Math.min(item.nextAttemptAt, now) } : item;
}

/** User-facing status line for an item. */
export function describeStatus(item: QueueTiming, isOnline: boolean): string {
  if (item.status === 'uploading') return 'Uploading…';
  if (item.status === 'failed') return `Failed: ${item.lastError ?? 'unknown error'}`;
  if (!isOnline) return 'Waiting for connection';
  return item.attempts > 0 ? 'Retrying soon…' : 'Waiting to upload';
}
