import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, View, useWindowDimensions } from 'react-native';

import { OfflineBanner } from '@/components/offline-banner';
import { gridTileSize, PhotoTile } from '@/components/photo-tile';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { formatPhotoCount } from '@/features/places/geo';
import { usePlace } from '@/features/places/hooks';
import { usePlacePhotos } from '@/features/photos/hooks';
import { formatRelativeDay } from '@/lib/format';

const COLUMNS = 3;
const GAP = 2;

export default function PlaceScreen() {
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  const place = usePlace(placeId);
  const photos = usePlacePhotos(placeId);
  const { width } = useWindowDimensions();
  const tile = gridTileSize(width, COLUMNS, Spacing.three, GAP);
  const items = photos.data?.pages.flatMap((page) => page.photos) ?? [];

  const subtitle = [place.data?.region, place.data?.country].filter(Boolean).join(', ');
  const stats = place.data
    ? [
        formatPhotoCount(place.data.photoCount),
        place.data.lastPhotoAt ? `latest ${formatRelativeDay(place.data.lastPhotoAt)}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: place.data?.name ?? '' }} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={COLUMNS}
        contentInsetAdjustmentBehavior="automatic"
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ gap: GAP, paddingHorizontal: Spacing.three, paddingBottom: Spacing.six }}
        ListHeaderComponent={
          <View style={{ paddingVertical: Spacing.three, gap: Spacing.half }}>
            <OfflineBanner style={{ marginBottom: Spacing.two }} />
            {subtitle ? <ThemedText themeColor="textSecondary">{subtitle}</ThemedText> : null}
            <ThemedText type="small" themeColor="textSecondary">
              {stats}
            </ThemedText>
          </View>
        }
        renderItem={({ item }) => (
          <PhotoTile
            uri={item.thumbUrl}
            size={tile}
            accessibilityLabel={`Photo from ${formatRelativeDay(item.takenAt)}`}
            onPress={() =>
              router.push({ pathname: '/photo/[photoId]', params: { photoId: item.id, from: 'place' } })
            }
          />
        )}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (photos.hasNextPage && !photos.isFetchingNextPage) photos.fetchNextPage();
        }}
        refreshing={photos.isRefetching && !photos.isFetchingNextPage}
        onRefresh={() => {
          place.refetch();
          photos.refetch();
        }}
        ListFooterComponent={
          photos.isFetchingNextPage ? <ActivityIndicator style={{ marginTop: Spacing.three }} /> : null
        }
        ListEmptyComponent={
          photos.isPending && photos.fetchStatus === 'paused' ? (
            <ThemedText themeColor="textSecondary" style={{ textAlign: 'center', paddingTop: Spacing.five }}>
              This place hasn’t been opened before. Its photos will load when you’re back online.
            </ThemedText>
          ) : photos.isPending ? (
            <ActivityIndicator style={{ marginTop: Spacing.six }} />
          ) : photos.isError ? (
            <View style={{ gap: Spacing.three, alignItems: 'center', paddingTop: Spacing.five }}>
              <ThemedText selectable>{photos.error.message}</ThemedText>
              <View style={{ flexDirection: 'row' }}>
                <PrimaryButton label="Try again" onPress={() => photos.refetch()} />
              </View>
            </View>
          ) : (
            <ThemedText themeColor="textSecondary" style={{ textAlign: 'center', paddingTop: Spacing.five }}>
              No photos here anymore.
            </ThemedText>
          )
        }
      />
    </ThemedView>
  );
}
