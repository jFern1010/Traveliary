import { Link, router } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, View, useWindowDimensions } from 'react-native';

import { OfflineBanner } from '@/components/offline-banner';
import { gridTileSize, PhotoTile } from '@/components/photo-tile';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import type { Photo } from '@/features/photos/api';
import { useDeleteMyPhoto, useMyPhotos } from '@/features/photos/hooks';
import { PendingUploads } from '@/features/upload-queue/pending-uploads';
import { isBackendConfigured } from '@/lib/env';

const COLUMNS = 3;
const GAP = 2;

export default function MyTripsScreen() {
  const photos = useMyPhotos();
  const deletePhoto = useDeleteMyPhoto();
  const { width } = useWindowDimensions();
  const tile = gridTileSize(width, COLUMNS, Spacing.three, GAP);

  function confirmDelete(photo: Photo) {
    Alert.alert('Delete this photo?', `It will be removed from ${photo.placeName} for everyone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deletePhoto.mutate(photo.id, {
            onError: (e) => Alert.alert('Couldn’t delete', e.message),
          }),
      },
    ]);
  }

  const count = photos.data?.length ?? 0;

  return (
    <ThemedView style={{ flex: 1 }}>
      <FlatList
        data={photos.data ?? []}
        keyExtractor={(item) => item.id}
        numColumns={COLUMNS}
        contentInsetAdjustmentBehavior="automatic"
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{
          gap: GAP,
          paddingHorizontal: Spacing.three,
          paddingBottom: BottomTabInset + Spacing.four,
        }}
        refreshControl={
          <RefreshControl refreshing={photos.isRefetching} onRefresh={() => photos.refetch()} />
        }
        ListHeaderComponent={
          <View style={{ paddingTop: Spacing.three, paddingBottom: Spacing.three, gap: Spacing.one }}>
            <ThemedText type="subtitle">My Trips</ThemedText>
            {count > 0 && (
              <ThemedText themeColor="textSecondary">
                {count} {count === 1 ? 'photo' : 'photos'} posted · long-press to delete
              </ThemedText>
            )}
            <OfflineBanner style={{ marginTop: Spacing.two }} />
            <View style={{ marginTop: Spacing.two }}>
              <PendingUploads />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <PhotoTile
            uri={item.thumbUrl}
            size={tile}
            caption={item.status === 'hidden' ? `Hidden · ${item.placeName}` : item.placeName}
            accessibilityLabel={`Photo at ${item.placeName}`}
            onPress={() =>
              router.push({ pathname: '/photo/[photoId]', params: { photoId: item.id } })
            }
            onLongPress={() => confirmDelete(item)}
          />
        )}
        ListEmptyComponent={<EmptyState state={photos} />}
        ListFooterComponent={
          // Developer tools exist only in development builds (Expo Go), never in a release build.
          __DEV__ ? (
            <View style={{ marginTop: Spacing.five, alignItems: 'center', gap: Spacing.one }}>
              <Link href="/dev/seed">
                <ThemedText type="link" themeColor="textSecondary">
                  Developer tools
                </ThemedText>
              </Link>
            </View>
          ) : null
        }
      />
    </ThemedView>
  );
}

function EmptyState({ state }: { state: ReturnType<typeof useMyPhotos> }) {
  if (!isBackendConfigured) {
    return (
      <Message
        title="Backend not connected"
        body="Add your Supabase URL and publishable key to .env.local, then restart npm start."
      />
    );
  }
  if (state.isPending && state.fetchStatus === 'paused') {
    return <Message title="Offline" body="Your posted photos will load when you’re back online." />;
  }
  if (state.isPending) {
    return (
      <View style={{ paddingTop: Spacing.six }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (state.isError) {
    return (
      <Message title="Couldn’t load your photos" body={state.error.message}>
        <PrimaryButton label="Try again" onPress={() => state.refetch()} />
      </Message>
    );
  }
  return (
    <Message title="No posts yet" body="Take a photo where you are and post it. It will show up here.">
      <PrimaryButton label="Open camera" onPress={() => router.navigate('/capture')} />
    </Message>
  );
}

function Message({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <View style={{ paddingTop: Spacing.five, gap: Spacing.three, alignItems: 'center' }}>
      <ThemedText type="smallBold" style={{ fontSize: 18 }}>
        {title}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }} selectable>
        {body}
      </ThemedText>
      {children && <View style={{ flexDirection: 'row' }}>{children}</View>}
    </View>
  );
}
