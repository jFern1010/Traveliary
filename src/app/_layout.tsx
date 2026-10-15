import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { configureNotificationHandler } from '@/features/notifications/register';
import { useUploadQueueRunner } from '@/features/upload-queue/hooks';
import { configureQueryEnvironment } from '@/lib/connectivity';
import { persistOptions, queryClient } from '@/lib/query-client';

configureNotificationHandler();
configureQueryEnvironment();

function UploadQueueRunner() {
  useUploadQueueRunner();
  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <UploadQueueRunner />
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="capture/preview"
            options={{ title: 'Post this photo?', headerBackTitle: 'Camera' }}
          />
          <Stack.Screen name="place/[placeId]" options={{ title: '', headerBackTitle: 'Back' }} />
          <Stack.Screen name="photo/[photoId]" options={{ title: 'Photo', headerBackTitle: 'Back' }} />
          <Stack.Screen name="dev/push" options={{ title: 'Push test' }} />
          <Stack.Screen name="dev/seed" options={{ title: 'Sample places' }} />
        </Stack>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
