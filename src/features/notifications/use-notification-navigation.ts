import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

function placeIdOf(response: Notifications.NotificationResponse | null): string | null {
  const placeId = response?.notification.request.content.data?.placeId;
  return typeof placeId === 'string' ? placeId : null;
}

/** Tapping a "New photo in <place>" notification opens that place, including from a cold start. */
export function useNotificationNavigation() {
  useEffect(() => {
    let handled: string | null = null;
    const open = (response: Notifications.NotificationResponse | null) => {
      const placeId = placeIdOf(response);
      const id = response?.notification.request.identifier ?? null;
      if (!placeId || id === handled) return;
      handled = id;
      // Otherwise the same tap is "replayed" on every app reload.
      Notifications.clearLastNotificationResponse();
      router.push({ pathname: '/place/[placeId]', params: { placeId } });
    };

    // The app was launched by tapping a notification. Deferred one tick so the navigator is mounted.
    const launch = setTimeout(() => open(Notifications.getLastNotificationResponse()), 0);
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => {
      clearTimeout(launch);
      subscription.remove();
    };
  }, []);
}
