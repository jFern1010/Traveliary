import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColor, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SheetOption = { label: string; onPress: () => void };

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  options: SheetOption[];
  onClose: () => void;
};

/**
 * Bottom sheet with a list of choices. Used instead of Alert when there are more than three
 * options, because Android alerts show at most three buttons.
 */
export function OptionSheet({ visible, title, message, options, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Close"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
      />
      <ThemedView
        style={{
          paddingTop: Spacing.four,
          paddingHorizontal: Spacing.three,
          paddingBottom: insets.bottom + Spacing.three,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          gap: Spacing.two,
        }}>
        <View style={{ gap: Spacing.one, paddingHorizontal: Spacing.two, paddingBottom: Spacing.two }}>
          <ThemedText type="smallBold" style={{ fontSize: 18 }}>
            {title}
          </ThemedText>
          {message && <ThemedText themeColor="textSecondary">{message}</ThemedText>}
        </View>
        {options.map((option) => (
          <Pressable
            key={option.label}
            accessibilityRole="button"
            onPress={() => {
              onClose();
              option.onPress();
            }}
            style={({ pressed }) => ({
              paddingVertical: Spacing.three,
              paddingHorizontal: Spacing.three,
              borderRadius: 12,
              backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
            })}>
            <ThemedText>{option.label}</ThemedText>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={{ paddingVertical: Spacing.three, alignItems: 'center' }}>
          <ThemedText type="smallBold" style={{ color: BrandColor, fontSize: 16 }}>
            Cancel
          </ThemedText>
        </Pressable>
      </ThemedView>
    </Modal>
  );
}
