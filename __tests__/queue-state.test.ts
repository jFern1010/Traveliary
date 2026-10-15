import {
  afterFailure,
  afterManualRetry,
  afterReconnect,
  backoffMs,
  describeStatus,
  isDue,
  MAX_AUTO_ATTEMPTS,
  type QueueTiming,
} from '@/features/upload-queue/queue-state';

const NOW = 1_000_000;
const fresh: QueueTiming = { status: 'pending', attempts: 0, nextAttemptAt: NOW, lastError: null };

describe('backoffMs', () => {
  it('doubles from 5 s and caps at 5 min', () => {
    expect(backoffMs(1)).toBe(5_000);
    expect(backoffMs(2)).toBe(10_000);
    expect(backoffMs(3)).toBe(20_000);
    expect(backoffMs(20)).toBe(300_000);
  });
});

describe('isDue', () => {
  it('runs pending items whose time has come', () => {
    expect(isDue(fresh, NOW)).toBe(true);
    expect(isDue({ ...fresh, nextAttemptAt: NOW + 1 }, NOW)).toBe(false);
  });

  it('never runs failed or in-flight items automatically', () => {
    expect(isDue({ ...fresh, status: 'failed' }, NOW)).toBe(false);
    expect(isDue({ ...fresh, status: 'uploading' }, NOW)).toBe(false);
  });
});

describe('afterFailure', () => {
  it('schedules a retry with backoff', () => {
    const next = afterFailure({ ...fresh, status: 'uploading' }, 'Network request failed', NOW);
    expect(next).toEqual({
      status: 'pending',
      attempts: 1,
      nextAttemptAt: NOW + 5_000,
      lastError: 'Network request failed',
    });
  });

  it('gives up after the max attempts and waits for the user', () => {
    let item: QueueTiming = fresh;
    for (let i = 0; i < MAX_AUTO_ATTEMPTS; i++) item = afterFailure(item, 'boom', NOW);
    expect(item.status).toBe('failed');
    expect(item.attempts).toBe(MAX_AUTO_ATTEMPTS);
  });
});

describe('afterManualRetry', () => {
  it('resets attempts and runs now', () => {
    const failed: QueueTiming = { status: 'failed', attempts: 5, nextAttemptAt: 0, lastError: 'x' };
    expect(afterManualRetry(failed, NOW)).toMatchObject({ status: 'pending', attempts: 0, nextAttemptAt: NOW });
  });
});

describe('afterReconnect', () => {
  it('makes backed-off pending items due now', () => {
    expect(afterReconnect({ ...fresh, nextAttemptAt: NOW + 60_000 }, NOW).nextAttemptAt).toBe(NOW);
  });

  it('leaves failed items alone', () => {
    const failed: QueueTiming = { ...fresh, status: 'failed', nextAttemptAt: NOW + 60_000 };
    expect(afterReconnect(failed, NOW)).toBe(failed);
  });
});

describe('describeStatus', () => {
  it('explains each state', () => {
    expect(describeStatus(fresh, false)).toBe('Waiting for connection');
    expect(describeStatus(fresh, true)).toBe('Waiting to upload');
    expect(describeStatus({ ...fresh, attempts: 2 }, true)).toBe('Retrying soon…');
    expect(describeStatus({ ...fresh, status: 'uploading' }, true)).toBe('Uploading…');
    expect(describeStatus({ ...fresh, status: 'failed', lastError: 'Server said no' }, true)).toBe(
      'Failed: Server said no',
    );
  });
});
