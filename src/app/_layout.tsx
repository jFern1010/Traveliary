import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { configureNotificationHandler } from '@/features/notifications/register';
import { queryClient } from '@/lib/query-client';

configureNotificationHandler();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
}
