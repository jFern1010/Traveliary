import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColor, Spacing } from '@/constants/theme';
import type { CaptureLocation } from '@/features/capture/capture-location';
import { clearDraft, getDraft } from '@/features/capture/draft';
import { formatCoordinates, formatPlaceLabel } from '@/features/capture/place-name';
import { usePostPhoto } from '@/features/photos/hooks';
import { usePromise, type PromiseState } from '@/hooks/use-promise';

export default function PreviewScreen() {
  // Read once: a new shutter press creates a new draft, which this screen should not pick up.
  const [draft] = useState(getDraft);
  const location = usePromise(draft?.location ?? null);
  const photo = usePromise(draft?.photo ?? null);
  const insets = useSafeAreaInsets();
  const postPhoto = usePostPhoto();

  if (!draft) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three }}>
        <ThemedText>No photo to preview.</ThemedText>
        <ThemedText type="linkPrimary" onPress={() => router.back()}>
          Back to camera
        </ThemedText>
      </ThemedView>
    );
  }

  const posting = postPhoto.isPending;
  const canPost = location.status === 'fulfilled' && photo.status === 'fulfilled' && !posting;
  const processing = location.status === 'pending' || photo.status === 'pending';

  function retake() {
    clearDraft();
    router.back();
  }

  function post() {
    if (!draft || location.status !== 'fulfilled' || photo.status !== 'fulfilled') return;
    const { latitude, longitude, accuracy, place } = location.value;
    postPhoto.mutate(
      {
        // Same ID on every retry of this draft, so the server never creates a duplicate.
        photoId: draft.id,
        takenAt: draft.takenAt,
        latitude,
        longitude,
        accuracy,
        place,
        files: photo.value,
      },
      {
        onSuccess: () => {
          clearDraft();
          router.navigate('/mine');
        },
        onError: (error) => {
          Alert.alert('Couldn’t post your photo', `${error.message}\n\nCheck your connection and try again.`);
        },
      },
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: Spacing.three, gap: Spacing.three }}>
        <Image
          source={{ uri: draft.previewUri }}
          style={{
            width: '100%',
            aspectRatio: draft.previewAspectRatio,
            borderRadius: 16,
          }}
          contentFit="cover"
          accessibilityLabel="Photo you just took"
        />

        <LocationCard state={location} />

        <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' }}>
          <SymbolView name="globe" tintColor="gray" size={18} />
          <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
            Posts are visible to everyone on Traveliary. Only the place name is shown, never your
            exact position.
          </ThemedText>
        </View>
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          gap: Spacing.two,
          paddingHorizontal: Spacing.three,
          paddingTop: Spacing.two,
          paddingBottom: insets.bottom + Spacing.two,
        }}>
        <PrimaryButton label="Retake" variant="secondary" onPress={retake} disabled={posting} />
        <PrimaryButton
          label={posting ? 'Posting…' : 'Post publicly'}
          onPress={post}
          disabled={!canPost}
          loading={processing || posting}
        />
      </View>
    </ThemedView>
  );
}

function LocationCard({ state }: { state: PromiseState<CaptureLocation> }) {
  let title: string;
  let detail: string | null = null;

  if (state.status === 'pending') {
    title = 'Finding your place…';
  } else if (state.status === 'rejected') {
    title = 'Couldn’t get your location';
    detail = `${state.error.message} Try again with a clear view of the sky, then retake.`;
  } else {
    const { place, latitude, longitude, accuracy } = state.value;
    title = place ? formatPlaceLabel(place) : formatCoordinates(latitude, longitude);
    const parts: string[] = [];
    if (!place) parts.push('Place name will be looked up when you’re online.');
    if (accuracy != null) parts.push(`Accurate to about ${Math.round(accuracy)} m.`);
    detail = parts.join(' ') || null;
  }

  return (
    <ThemedView
      type="backgroundElement"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.three,
        padding: Spacing.three,
        borderRadius: 14,
        borderCurve: 'continuous',
      }}>
      {state.status === 'pending' ? (
        <ActivityIndicator />
      ) : (
        <SymbolView
          name={state.status === 'rejected' ? 'location.slash.fill' : 'mappin.and.ellipse'}
          tintColor={state.status === 'rejected' ? '#E5484D' : BrandColor}
          size={26}
        />
      )}
      <View style={{ flex: 1, gap: Spacing.half }}>
        <ThemedText type="smallBold" style={{ fontSize: 17 }} selectable>
          {title}
        </ThemedText>
        {detail && (
          <ThemedText type="small" themeColor="textSecondary" selectable>
            {detail}
          </ThemedText>
        )}
      </View>
    </ThemedView>
  );
}
