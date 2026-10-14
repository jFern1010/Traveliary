import { Image } from 'expo-image';
import { Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type Props = {
  uri: string;
  size: number;
  /** Optional caption over the bottom edge, e.g. the place name in My Trips. */
  caption?: string;
  accessibilityLabel: string;
  onPress: () => void;
  onLongPress?: () => void;
};

/** Square thumbnail used by photo grids. */
export function PhotoTile({ uri, size, caption, accessibilityLabel, onPress, onLongPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: 4 }}
        contentFit="cover"
        transition={150}
        recyclingKey={uri}
      />
      {caption && (
        <ThemedText
          type="small"
          numberOfLines={1}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: Spacing.one,
            color: 'white',
            fontSize: 11,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
          }}>
          {caption}
        </ThemedText>
      )}
    </Pressable>
  );
}

/** Tile size for an N-column grid with the given horizontal padding and gap. */
export function gridTileSize(screenWidth: number, columns: number, padding: number, gap: number) {
  return (screenWidth - padding * 2 - gap * (columns - 1)) / columns;
}
