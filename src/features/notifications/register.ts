import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { resolveProjectId } from './project-id';

export type PushRegistration =
  | { status: 'granted'; token: string }
  | { status: 'denied' }
  | { status: 'unsupported'; reason: string }
  | { status: 'error'; message: string };

/** Show notifications as banners even when the app is in the foreground. */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/** Android channel for "New photo in <place>" pushes (must exist before asking permission on Android 13+). */
export const NEW_PHOTOS_CHANNEL_ID = 'new-photos';

async function ensureAndroidChannel() {
  if (process.env.EXPO_OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(NEW_PHOTOS_CHANNEL_ID, {
    name: 'New photos at your places',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function registerForPushToken(): Promise<PushRegistration> {
  // The iOS Simulator cannot receive remote pushes; Android emulators with Google Play can.
  if (!Device.isDevice && process.env.EXPO_OS === 'ios') {
    return { status: 'unsupported', reason: 'Push notifications need a physical device.' };
  }

  const projectId = resolveProjectId(Constants);
  if (!projectId) {
    return {
      status: 'unsupported',
      reason: 'No EAS projectId found. Run `npx eas-cli@latest init` in the project folder.',
    };
  }

  try {
    await ensureAndroidChannel();
    const existing = await Notifications.getPermissionsAsync();
    const permission = existing.granted ? existing : await Notifications.requestPermissionsAsync();
    if (!permission.granted) {
      return { status: 'denied' };
    }

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { status: 'granted', token: data };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}
