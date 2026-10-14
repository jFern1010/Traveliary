import { ActivityIndicator, Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BrandColor, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
};

export function PrimaryButton({ label, onPress, variant = 'primary', disabled, loading }: Props) {
  const theme = useTheme();
  const isPrimary = variant === 'primary';
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 52,
        flexDirection: 'row',
        gap: Spacing.two,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.three,
        borderRadius: 14,
        borderCurve: 'continuous',
        backgroundColor: isPrimary ? BrandColor : theme.backgroundElement,
        opacity: inactive ? 0.5 : pressed ? 0.8 : 1,
      })}>
      {loading && <ActivityIndicator color={isPrimary ? 'white' : theme.text} />}
      <ThemedText type="smallBold" style={{ color: isPrimary ? 'white' : theme.text, fontSize: 16 }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}
