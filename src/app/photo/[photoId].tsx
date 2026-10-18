import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';

import { Icon } from '@/components/icon';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColor, Spacing } from '@/constants/theme';
import { useBlockAuthor, useReportPhoto } from '@/features/moderation/api';
import { REPORT_REASONS, reportOutcomeMessage } from '@/features/moderation/reasons';
import { useDeleteMyPhoto, usePhoto } from '@/features/photos/hooks';
import { formatDate } from '@/lib/format';

export default function PhotoScreen() {
  const { photoId, from } = useLocalSearchParams<{ photoId: string; from?: string }>();
  const photo = usePhoto(photoId);
  const deletePhoto = useDeleteMyPhoto();
  const reportPhoto = useReportPhoto();
  const blockAuthor = useBlockAuthor();

  if (photo.isPending && photo.fetchStatus === 'paused') {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.four }}>
        <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
          You’re offline. This photo will load when you’re back online.
        </ThemedText>
      </ThemedView>
    );
  }
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

  function chooseReportReason() {
    Alert.alert('Report this photo', 'Why should it be removed?', [
      ...REPORT_REASONS.map((r) => ({
        text: r.label,
        onPress: () =>
          reportPhoto.mutate(
            { photoId: p.id, reason: r.value },
            {
              onSuccess: (outcome) =>
                Alert.alert('Reported', reportOutcomeMessage(outcome), [
                  { text: 'OK', onPress: () => router.back() },
                ]),
              onError: (e) => Alert.alert('Couldn’t report', e.message),
            },
          ),
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function confirmBlock() {
    Alert.alert(
      'Block this traveler?',
      'You won’t see any of their photos or get notifications about them. They won’t be told. You can unblock everyone from About.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () =>
            blockAuthor.mutate(p.id, {
              onSuccess: () => router.back(),
              onError: (e) => Alert.alert('Couldn’t block', e.message),
            }),
        },
      ],
    );
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
            <Icon name="mapPin" color={BrandColor} size={22} />
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
            {from !== 'place' && <Icon name="chevronRight" color="gray" size={14} />}
          </Pressable>

          <ThemedText type="small" themeColor="textSecondary">
            Taken {formatDate(p.takenAt)}
            {p.isMine ? ' · by you' : ''}
          </ThemedText>

          {p.isMine && p.status === 'hidden' && (
            <ThemedView
              type="backgroundElement"
              style={{ flexDirection: 'row', gap: Spacing.two, padding: Spacing.three, borderRadius: 12 }}>
              <Icon name="hidden" color="#E5484D" size={18} />
              <ThemedText type="small" style={{ flex: 1 }}>
                Hidden: several travelers reported this photo, so only you can see it.
              </ThemedText>
            </ThemedView>
          )}

          {!p.isMine && (
            <View style={{ flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three }}>
              <PrimaryButton
                label="Report photo"
                variant="secondary"
                onPress={chooseReportReason}
                loading={reportPhoto.isPending}
              />
              <PrimaryButton
                label="Block traveler"
                variant="secondary"
                onPress={confirmBlock}
                loading={blockAuthor.isPending}
              />
            </View>
          )}

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
