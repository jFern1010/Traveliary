import { SymbolView } from 'expo-symbols';
import { View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useIsOnline } from '@/lib/connectivity';

/** Shown while offline; explains that what's on screen is saved content. Renders nothing when online. */
export function OfflineBanner({ style }: { style?: ViewStyle }) {
  const online = useIsOnline();
  if (online) return null;
  return (
    <View
      accessibilityRole="alert"
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.two,
          paddingHorizontal: Spacing.three,
          paddingVertical: Spacing.two,
          borderRadius: 12,
          borderCurve: 'continuous',
          backgroundColor: '#3A3A3C',
        },
        style,
      ]}>
      <SymbolView name="wifi.slash" tintColor="white" size={16} />
      <ThemedText type="small" style={{ color: 'white', flex: 1 }}>
        You’re offline. Showing saved places and photos.
      </ThemedText>
    </View>
  );
}
