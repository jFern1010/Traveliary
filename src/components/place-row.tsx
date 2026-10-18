import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { PlaceSummary } from '@/features/places/api';
import { formatDistance, formatPhotoCount } from '@/features/places/geo';
import { useTheme } from '@/hooks/use-theme';

export function PlaceRow({ place, onPress }: { place: PlaceSummary; onPress: () => void }) {
  const theme = useTheme();
  const meta = [
    formatPhotoCount(place.photoCount),
    place.distanceMeters != null ? formatDistance(place.distanceMeters) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${place.name}, ${meta}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <ThemedView
        type="backgroundElement"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.three,
          padding: Spacing.two,
          borderRadius: 14,
          borderCurve: 'continuous',
        }}>
        {place.coverThumbUrl ? (
          <Image
            source={{ uri: place.coverThumbUrl }}
            style={{ width: 64, height: 64, borderRadius: 10 }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.backgroundSelected,
            }}>
            <Icon name="photo" color={theme.textSecondary} size={24} />
          </View>
        )}
        <View style={{ flex: 1, gap: Spacing.half }}>
          <ThemedText type="smallBold" style={{ fontSize: 17 }} numberOfLines={1}>
            {place.name}
          </ThemedText>
          {place.country && (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {place.country}
            </ThemedText>
          )}
          <ThemedText type="small" themeColor="textSecondary" style={{ fontVariant: ['tabular-nums'] }}>
            {meta}
          </ThemedText>
        </View>
        <Icon name="chevronRight" color={theme.textSecondary} size={14} />
      </ThemedView>
    </Pressable>
  );
}
