import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { configureNotificationHandler } from '@/features/notifications/register';
import { offerNotificationsOnce, syncPushTokenIfAllowed } from '@/features/notifications/setup';
import { useNotificationNavigation } from '@/features/notifications/use-notification-navigation';
import { hasAcceptedCurrentTerms } from '@/features/onboarding/storage';
import { useUploadQueueRunner } from '@/features/upload-queue/hooks';
import { onUploaded } from '@/features/upload-queue/queue';
import { configureQueryEnvironment } from '@/lib/connectivity';
import { persistOptions, queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';

configureNotificationHandler();
configureQueryEnvironment();

/** App-wide background behavior that needs React context (query client, router). Renders nothing. */
function AppServices() {
  useUploadQueueRunner();
  useNotificationNavigation();
  useEffect(() => {
    // First launch (or new Terms): explain that posts are public and ask for agreement.
    void hasAcceptedCurrentTerms().then((accepted) => {
      if (!accepted) router.push('/onboarding');
    });
  }, []);

  useEffect(() => {
    void syncPushTokenIfAllowed();
    // A new anonymous identity must take over this device's push token right away.
    const { data: auth } = supabase.auth.onAuthStateChange((event) => {
      // Deferred: calling Supabase inside this callback can deadlock its auth lock.
      if (event === 'SIGNED_IN') setTimeout(() => void syncPushTokenIfAllowed(), 0);
    });
    // The first successful post is the moment notifications make sense, so offer them then.
    const stopOffering = onUploaded(() => void offerNotificationsOnce());
    return () => {
      auth.subscription.unsubscribe();
      stopOffering();
    };
  }, []);
  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="capture/preview"
            options={{ title: 'Post this photo?', headerBackTitle: 'Camera' }}
          />
          <Stack.Screen name="place/[placeId]" options={{ title: '', headerBackTitle: 'Back' }} />
          <Stack.Screen name="photo/[photoId]" options={{ title: 'Photo', headerBackTitle: 'Back' }} />
          <Stack.Screen
            name="onboarding"
            options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen name="about" options={{ title: 'About', headerBackTitle: 'Back' }} />
          <Stack.Screen
            name="legal/[doc]"
            options={{ title: '', presentation: 'modal', headerBackTitle: 'Back' }}
          />
          <Stack.Screen name="dev/seed" options={{ title: 'Developer tools' }} />
        </Stack>
        <AppServices />
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
