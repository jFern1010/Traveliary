import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { env, isBackendConfigured } from './env';

// Placeholder values keep the app booting without .env.local; API calls then fail with a clear message.
export const supabase = createClient(
  env.supabaseUrl || 'https://not-configured.invalid',
  env.supabaseKey || 'not-configured',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// React Native has no "tab visible" events, so refresh the session only while the app is in the foreground.
if (isBackendConfigured) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

export const PHOTO_BUCKET = 'photos';
