import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';

import { savePushToken } from './api';
import { registerForPushToken } from './register';

const PROMPTED_KEY = 'traveliary.notifications-prompted';

async function registerAndSave(): Promise<void> {
  const result = await registerForPushToken();
  if (result.status === 'granted') {
    await savePushToken(result.token);
  } else if (result.status !== 'denied') {
    console.warn('Push registration skipped:', result.status === 'error' ? result.message : result.reason);
  }
}

/** At app start: if notifications are already allowed, make sure the server has this device's current token. */
export async function syncPushTokenIfAllowed(): Promise<void> {
  try {
    const { granted } = await Notifications.getPermissionsAsync();
    if (granted) await registerAndSave();
  } catch (e) {
    console.warn('Push token sync failed:', e);
  }
}

/**
 * After the user's first successful post: explain the benefit, then show the iOS prompt.
 * Asks once; if they decline here or in the system prompt we don't nag again.
 */
export async function offerNotificationsOnce(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(PROMPTED_KEY)) return;
    const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
    if (granted) {
      await registerAndSave();
      await AsyncStorage.setItem(PROMPTED_KEY, '1');
      return;
    }
    if (!canAskAgain) return;

    await AsyncStorage.setItem(PROMPTED_KEY, '1');
    Alert.alert(
      'Posted! Want to know who comes next?',
      'Get a notification when other travelers post at a place you’ve been.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Notify me', onPress: () => void registerAndSave().catch((e) => console.warn(e)) },
      ],
    );
  } catch (e) {
    console.warn('Notification offer failed:', e);
  }
}

/** After "Delete my data": offer notifications again to the new identity after its first post. */
export async function resetNotificationOffer(): Promise<void> {
  await AsyncStorage.removeItem(PROMPTED_KEY);
}
