import AsyncStorage from '@react-native-async-storage/async-storage';

import { LEGAL_VERSION } from '@/constants/app-info';

const ACCEPTED_KEY = 'traveliary.terms-accepted';

/** True once the user has agreed to the *current* Terms and Privacy Policy (see LEGAL_VERSION). */
export async function hasAcceptedCurrentTerms(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ACCEPTED_KEY)) === LEGAL_VERSION;
  } catch {
    // If storage is unreadable, don't block the app behind onboarding.
    return true;
  }
}

export async function acceptCurrentTerms(): Promise<void> {
  await AsyncStorage.setItem(ACCEPTED_KEY, LEGAL_VERSION);
}
