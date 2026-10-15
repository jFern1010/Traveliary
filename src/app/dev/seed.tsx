import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { SAMPLES, seedSamplePlaces } from '@/features/dev/seed';
import { simulateOtherTraveler, simulateReports } from '@/features/dev/simulate-traveler';

/** Developer tools: sample data for Explore, plus one-phone tests for push and reporting. */
export default function DevToolsScreen() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<'seed' | 'visitor' | 'reports' | null>(null);

  async function run(kind: 'seed' | 'visitor' | 'reports') {
    setBusy(kind);
    try {
      if (kind === 'seed') {
        const count = await seedSamplePlaces(setStatus);
        setStatus(`Done: posted ${count} sample photos.`);
      } else if (kind === 'reports') {
        setStatus(`Done: ${await simulateReports(setStatus)} Check My Trips for the “Hidden” label.`);
      } else {
        const placeName = await simulateOtherTraveler(setStatus);
        setStatus(
          `Done: another traveler posted at ${placeName}. A notification should arrive within a few seconds. ` +
            'Press the Home button first if you want to see it on the lock screen.',
        );
      }
    } catch (e) {
      setStatus(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      await queryClient.invalidateQueries();
      setBusy(null);
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: Spacing.four, gap: Spacing.three }}>
        <ThemedText type="smallBold" style={{ fontSize: 18 }}>
          Sample places
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Posts {SAMPLES.length} placeholder photos as you, at fixed spots in Zermatt, Paris and Tokyo.
          They appear in My Trips, so you can delete them there afterwards.
        </ThemedText>
        <View style={{ flexDirection: 'row' }}>
          <PrimaryButton
            label="Add sample places"
            onPress={() => run('seed')}
            loading={busy === 'seed'}
            disabled={busy !== null}
          />
        </View>

        <ThemedText type="smallBold" style={{ fontSize: 18, marginTop: Spacing.four }}>
          Simulate another traveler
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Briefly signs in as a second anonymous traveler, posts a sample photo at the place of your
          most recent post, then switches back to you. You should get a “New photo in …” notification.
          Needs notifications allowed. The same place notifies at most once per hour.
        </ThemedText>
        <View style={{ flexDirection: 'row' }}>
          <PrimaryButton
            label="Simulate a visitor"
            onPress={() => run('visitor')}
            loading={busy === 'visitor'}
            disabled={busy !== null}
          />
        </View>

        <ThemedText type="smallBold" style={{ fontSize: 18, marginTop: Spacing.four }}>
          Simulate reports
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Three temporary travelers report your most recent photo. At 3 reports it is hidden for
          everyone except you.
        </ThemedText>
        <View style={{ flexDirection: 'row' }}>
          <PrimaryButton
            label="Report my latest photo ×3"
            onPress={() => run('reports')}
            loading={busy === 'reports'}
            disabled={busy !== null}
          />
        </View>

        {status && (
          <ThemedText type="small" selectable style={{ marginTop: Spacing.three }}>
            {status}
          </ThemedText>
        )}
      </ScrollView>
    </ThemedView>
  );
}
