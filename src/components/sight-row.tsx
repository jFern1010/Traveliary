import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SightColor, Spacing } from '@/constants/theme';
import { formatKm } from '@/features/sights/links';
import type { RankedSight } from '@/features/sights/rank';
import { useTheme } from '@/hooks/use-theme';

export function SightRow({ sight, rank, onPress }: { sight: RankedSight; rank: number; onPress: () => void }) {
  const theme = useTheme();
  const meta = [
    formatKm(sight.distanceKm),
    sight.travelerPhotos > 0
      ? `${sight.travelerPhotos} ${sight.travelerPhotos === 1 ? 'traveler photo' : 'traveler photos'}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${rank}. ${sight.name}, ${meta}`}
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
        <View>
          {sight.imageUrl ? (
            <Image
              source={{ uri: sight.imageUrl }}
              style={{ width: 72, height: 72, borderRadius: 10 }}
              contentFit="cover"
              transition={150}
              recyclingKey={sight.id}
            />
          ) : (
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.backgroundSelected,
              }}>
              <Icon name="star" color={SightColor} size={28} />
            </View>
          )}
          <View
            style={{
              position: 'absolute',
              top: -6,
              left: -6,
              minWidth: 24,
              height: 24,
              paddingHorizontal: 6,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: SightColor,
            }}>
            <ThemedText type="smallBold" style={{ color: 'white', fontSize: 12, lineHeight: 16 }}>
              {rank}
            </ThemedText>
          </View>
        </View>
        <View style={{ flex: 1, gap: Spacing.half }}>
          <ThemedText type="smallBold" style={{ fontSize: 17 }} numberOfLines={2}>
            {sight.name}
          </ThemedText>
          {sight.description && (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {sight.description}
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
