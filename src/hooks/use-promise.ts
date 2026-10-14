import { useEffect, useState } from 'react';

export type PromiseState<T> =
  | { status: 'pending' }
  | { status: 'fulfilled'; value: T }
  | { status: 'rejected'; error: Error };

type Tracked<T> = { promise: Promise<T> | null; state: PromiseState<T> };

/** Tracks a promise that was started elsewhere (e.g. at shutter press) and re-renders when it settles. */
export function usePromise<T>(promise: Promise<T> | null): PromiseState<T> {
  const [tracked, setTracked] = useState<Tracked<T>>({ promise, state: { status: 'pending' } });

  useEffect(() => {
    if (!promise) return;
    let cancelled = false;
    promise.then(
      (value) => {
        if (!cancelled) setTracked({ promise, state: { status: 'fulfilled', value } });
      },
      (error: unknown) => {
        if (!cancelled) {
          const err = error instanceof Error ? error : new Error(String(error));
          setTracked({ promise, state: { status: 'rejected', error: err } });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [promise]);

  // A newer promise than the one we last settled is still pending.
  return tracked.promise === promise ? tracked.state : { status: 'pending' };
}
