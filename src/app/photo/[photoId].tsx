import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColor, Spacing } from '@/constants/theme';
import { useDeleteMyPhoto, usePhoto } from '@/features/photos/hooks';
import { formatDate } from '@/lib/format';

export default function PhotoScreen() {
  const { photoId, from } = useLocalSearchParams<{ photoId: string; from?: string }>();
  const photo = usePhoto(photoId);
  const deletePhoto = useDeleteMyPhoto();

  if (photo.isPending) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </ThemedView>
    );
  }
  if (photo.isError) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.three }}>
        <ThemedText selectable>{photo.error.message}</ThemedText>
        <ThemedText type="linkPrimary" onPress={() => router.back()}>
          Go back
        </ThemedText>
      </ThemedView>
    );
  }

  const p = photo.data;

  function confirmDelete() {
    Alert.alert('Delete this photo?', `It will be removed from ${p.placeName} for everyone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deletePhoto.mutate(p.id, {
            onSuccess: () => router.back(),
            onError: (e) => Alert.alert('Couldn’t delete', e.message),
          }),
      },
    ]);
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ gap: Spacing.three, paddingBottom: Spacing.six }}>
        <Image
          source={{ uri: p.fullUrl }}
          placeholder={{ uri: p.thumbUrl }}
          style={{ width: '100%', aspectRatio: p.width / p.height }}
          contentFit="contain"
          transition={200}
          accessibilityLabel={`Photo taken at ${p.placeName}`}
        />

        <View style={{ paddingHorizontal: Spacing.three, gap: Spacing.three }}>
          {/* Coming from the place gallery, linking back to the same place would be a loop. */}
          <Pressable
            disabled={from === 'place'}
            onPress={() =>
              router.push({ pathname: '/place/[placeId]', params: { placeId: p.placeId } })
            }
            accessibilityRole={from === 'place' ? undefined : 'link'}
            style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
            <SymbolView name="mappin.and.ellipse" tintColor={BrandColor} size={22} />
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold" style={{ fontSize: 18 }}>
                {p.placeName}
              </ThemedText>
              {p.placeCountry && (
                <ThemedText type="small" themeColor="textSecondary">
                  {p.placeCountry}
                </ThemedText>
              )}
            </View>
            {from !== 'place' && <SymbolView name="chevron.right" tintColor="gray" size={14} />}
          </Pressable>

          <ThemedText type="small" themeColor="textSecondary">
            Taken {formatDate(p.takenAt)}
            {p.isMine ? ' · by you' : ''}
          </ThemedText>

          {p.isMine && (
            <View style={{ flexDirection: 'row', marginTop: Spacing.three }}>
              <PrimaryButton
                label="Delete photo"
                variant="secondary"
                onPress={confirmDelete}
                loading={deletePhoto.isPending}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}
