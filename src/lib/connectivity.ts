import NetInfo, { useNetInfo, type NetInfoState } from '@react-native-community/netinfo';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { AppState } from 'react-native';

/** Unknown (null) counts as online, so the first render doesn't flash an offline banner. */
export function isOnlineState(state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

export function useIsOnline(): boolean {
  return isOnlineState(useNetInfo());
}

/** Calls `listener` each time the device goes from offline to online. Returns an unsubscribe function. */
export function onReconnect(listener: () => void): () => void {
  let wasOnline = true;
  return NetInfo.addEventListener((state) => {
    const online = isOnlineState(state);
    if (online && !wasOnline) listener();
    wasOnline = online;
  });
}

export async function isOnlineNow(): Promise<boolean> {
  return isOnlineState(await NetInfo.fetch());
}

let configured = false;

/**
 * Teaches TanStack Query about React Native: pause fetching while offline (cached data stays on
 * screen) and refetch stale data when the app returns to the foreground.
 */
export function configureQueryEnvironment() {
  if (configured) return;
  configured = true;
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(isOnlineState(state))),
  );
  focusManager.setEventListener((setFocused) => {
    const subscription = AppState.addEventListener('change', (status) =>
      setFocused(status === 'active'),
    );
    return () => subscription.remove();
  });
}
