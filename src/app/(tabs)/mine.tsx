import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Link, router } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, View, useWindowDimensions } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import type { MyPhoto } from '@/features/photos/api';
import { useDeleteMyPhoto, useMyPhotos } from '@/features/photos/hooks';
import { isBackendConfigured } from '@/lib/env';

const COLUMNS = 3;
const GAP = 2;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function MyTripsScreen() {
  const photos = useMyPhotos();
  const deletePhoto = useDeleteMyPhoto();
  const { width } = useWindowDimensions();
  const tile = (width - Spacing.three * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  function confirmDelete(photo: MyPhoto) {
    Alert.alert(
      'Delete this photo?',
      `It will be removed from ${photo.placeName} for everyone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deletePhoto.mutate(photo.id, {
              onError: (e) => Alert.alert('Couldn’t delete', e.message),
            }),
        },
      ],
    );
  }

  function openPhoto(photo: MyPhoto) {
    Alert.alert(
      photo.placeName,
      `${photo.placeCountry ? `${photo.placeCountry} · ` : ''}${formatDate(photo.takenAt)}`,
      [
        { text: 'Close', style: 'cancel' },
        { text: 'Delete photo', style: 'destructive', onPress: () => confirmDelete(photo) },
      ],
    );
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
          <RefreshControl
            refreshing={photos.isRefetching}
            onRefresh={() => photos.refetch()}
          />
        }
        ListHeaderComponent={
          <View style={{ paddingTop: Spacing.three, paddingBottom: Spacing.three, gap: Spacing.one }}>
            <ThemedText type="subtitle">My Trips</ThemedText>
            {count > 0 && (
              <ThemedText themeColor="textSecondary">
                {count} {count === 1 ? 'photo' : 'photos'} posted
              </ThemedText>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openPhoto(item)}
            onLongPress={() => confirmDelete(item)}
            accessibilityRole="button"
            accessibilityLabel={`Photo at ${item.placeName}`}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Image
              source={{ uri: item.thumbUrl }}
              style={{ width: tile, height: tile, borderRadius: 4 }}
              contentFit="cover"
              transition={150}
            />
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
              {item.placeName}
            </ThemedText>
          </Pressable>
        )}
        ListEmptyComponent={<EmptyState state={photos} />}
        ListFooterComponent={
          // Temporary M0 entry point; removed when push is wired up for real in M5.
          <Link href="/dev/push" style={{ marginTop: Spacing.five, alignSelf: 'center' }}>
            <ThemedText type="link" themeColor="textSecondary">
              Developer: push notification test
            </ThemedText>
          </Link>
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
        <View style={{ flexDirection: 'row' }}>
          <PrimaryButton label="Try again" onPress={() => state.refetch()} />
        </View>
      </Message>
    );
  }
  return (
    <Message title="No posts yet" body="Take a photo where you are and post it. It will show up here.">
      <View style={{ flexDirection: 'row' }}>
        <PrimaryButton label="Open camera" onPress={() => router.navigate('/capture')} />
      </View>
    </Message>
  );
}

function Message({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <View style={{ paddingTop: Spacing.five, gap: Spacing.three, alignItems: 'center' }}>
      <ThemedText type="smallBold" style={{ fontSize: 18 }}>
        {title}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }} selectable>
        {body}
      </ThemedText>
      {children}
    </View>
  );
}
