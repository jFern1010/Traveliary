import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { configureNotificationHandler } from '@/features/notifications/register';
import { offerNotificationsOnce, syncPushTokenIfAllowed } from '@/features/notifications/setup';
import { useNotificationNavigation } from '@/features/notifications/use-notification-navigation';
import { useUploadQueueRunner } from '@/features/upload-queue/hooks';
import { onUploaded } from '@/features/upload-queue/queue';
import { configureQueryEnvironment } from '@/lib/connectivity';
import { persistOptions, queryClient } from '@/lib/query-client';

configureNotificationHandler();
configureQueryEnvironment();

/** App-wide background behavior that needs React context (query client, router). Renders nothing. */
function AppServices() {
  useUploadQueueRunner();
  useNotificationNavigation();
  useEffect(() => {
    void syncPushTokenIfAllowed();
    // The first successful post is the moment notifications make sense, so offer them then.
    return onUploaded(() => void offerNotificationsOnce());
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
          <Stack.Screen name="dev/seed" options={{ title: 'Developer tools' }} />
        </Stack>
        <AppServices />
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
