import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { LEGAL_CONTENT, LEGAL_TITLES, type LegalDoc } from '@/features/legal/content';

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const key: LegalDoc = doc === 'privacy' ? 'privacy' : 'terms';

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: LEGAL_TITLES[key] }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.six }}>
        {LEGAL_CONTENT[key].map((section) => (
          <View key={section.heading} style={{ gap: Spacing.one }}>
            <ThemedText type="smallBold" style={{ fontSize: 17 }}>
              {section.heading}
            </ThemedText>
            <ThemedText themeColor="textSecondary" selectable>
              {section.body}
            </ThemedText>
          </View>
        ))}
      </ScrollView>
    </ThemedView>
  );
}
