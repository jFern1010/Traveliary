import type { ReactNode } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/** Centered title + explanation (+ optional action) for empty, offline and error states in lists. */
export function EmptyMessage({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <View style={{ paddingTop: Spacing.five, gap: Spacing.three, alignItems: 'center' }}>
      <ThemedText type="smallBold" style={{ fontSize: 18, textAlign: 'center' }}>
        {title}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }} selectable>
        {body}
      </ThemedText>
      {children && <View style={{ flexDirection: 'row' }}>{children}</View>}
    </View>
  );
}
