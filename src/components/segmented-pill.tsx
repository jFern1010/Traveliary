import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/** Compact two-or-three-way switch that floats over the map. */
export function SegmentedPill<T extends string>({ options, value, onChange }: Props<T>) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        alignSelf: 'center',
        padding: 3,
        borderRadius: 99,
        backgroundColor: theme.backgroundElement,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={{
              paddingHorizontal: Spacing.four,
              paddingVertical: Spacing.two,
              borderRadius: 99,
              backgroundColor: selected ? theme.background : 'transparent',
            }}>
            <ThemedText
              type="smallBold"
              themeColor={selected ? 'text' : 'textSecondary'}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}
