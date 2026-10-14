import { Link } from 'expo-router';

import { PlaceholderScreen } from '@/components/placeholder-screen';
import { ThemedText } from '@/components/themed-text';

export default function MyTripsScreen() {
  return (
    <PlaceholderScreen
      title="My Trips"
      description="Your posted photos and pending uploads will live here (M2).">
      {/* Temporary M0 entry point; removed when push is wired up for real in M5. */}
      <Link href="/dev/push">
        <ThemedText type="linkPrimary">Developer: push notification test</ThemedText>
      </Link>
    </PlaceholderScreen>
  );
}
