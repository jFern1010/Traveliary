import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { SAMPLES, seedSamplePlaces } from '@/features/dev/seed';

/** Dev screen: fills the map with sample places so Explore can be tested from anywhere. */
export default function SeedScreen() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const count = await seedSamplePlaces(setStatus);
      setStatus(`Done: posted ${count} sample photos.`);
      await queryClient.invalidateQueries();
    } catch (e) {
      setStatus(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: Spacing.four, gap: Spacing.three }}>
        <ThemedText themeColor="textSecondary">
          Posts {SAMPLES.length} placeholder photos as you, at fixed spots in Zermatt, Paris and Tokyo.
          They appear in My Trips, so you can delete them there afterwards.
        </ThemedText>
        {SAMPLES.map((s) => (
          <ThemedText key={s.label} type="small">
            • {s.label} ({s.place.name}, {s.place.country})
          </ThemedText>
        ))}
        <View style={{ flexDirection: 'row', marginTop: Spacing.three }}>
          <PrimaryButton label="Add sample places" onPress={run} loading={busy} />
        </View>
        {status && (
          <ThemedText type="small" selectable>
            {status}
          </ThemedText>
        )}
      </ScrollView>
    </ThemedView>
  );
}
