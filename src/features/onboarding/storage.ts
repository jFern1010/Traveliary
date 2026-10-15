import AsyncStorage from '@react-native-async-storage/async-storage';

const SEEN_KEY = 'traveliary.onboarding-seen.v1';

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SEEN_KEY)) !== null;
  } catch {
    // If storage is unreadable, don't block the app behind onboarding.
    return true;
  }
}

export async function markOnboardingSeen(): Promise<void> {
  await AsyncStorage.setItem(SEEN_KEY, new Date().toISOString());
}
