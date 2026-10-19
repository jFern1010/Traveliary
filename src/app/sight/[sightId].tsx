import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Linking, ScrollView, View, useWindowDimensions } from 'react-native';

import { Icon } from '@/components/icon';
import { gridTileSize, PhotoTile } from '@/components/photo-tile';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColor, SightColor, Spacing } from '@/constants/theme';
import { useUserPosition } from '@/features/places/use-user-position';
import { useCachedSight, usePhotosNearSight, useSightSummary } from '@/features/sights/hooks';
import { commonsFilePage, directionsUrl, formatKm } from '@/features/sights/links';
import { SightsCredit } from '@/features/sights/must-see-list';
import { distanceKm, wikipediaUrl } from '@/features/sights/rank';
import { useTheme } from '@/hooks/use-theme';

const COLUMNS = 3;
const GAP = 2;
/** Close enough to post "here": matches the 300 m used for traveler photo counts. */
const HERE_KM = 0.3;

function openInBrowser(url: string) {
  WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url));
}

export default function SightScreen() {
  const { sightId } = useLocalSearchParams<{ sightId: string }>();
  const sight = useCachedSight(sightId);
  const user = useUserPosition();
  const summary = useSightSummary(sight);
  const photos = usePhotosNearSight(sight);
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const tile = gridTileSize(width, COLUMNS, Spacing.three, GAP);

  if (!sight) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four }}>
        <Stack.Screen options={{ title: '' }} />
        <ThemedText style={{ textAlign: 'center' }}>This place isn’t loaded anymore. Open Must see again.</ThemedText>
        <ThemedText type="linkPrimary" onPress={() => router.back()}>
          Go back
        </ThemedText>
      </ThemedView>
    );
  }

  const km = user.position ? distanceKm(user.position.latitude, user.position.longitude, sight.lat, sight.lng) : null;
  const articleUrl = summary.data?.pageUrl ?? wikipediaUrl(sight);
  const photoCredit = commonsFilePage(sight.imageUrl);
  const isHere = km !== null && km <= HERE_KM;

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: sight.name }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: Spacing.six }}>
        {sight.imageUrl ? (
          <Image
            source={{ uri: sight.imageUrl }}
            style={{ width: '100%', aspectRatio: 4 / 3 }}
            contentFit="cover"
            transition={200}
            accessibilityLabel={`Photo of ${sight.name}`}
          />
        ) : (
          <View
            style={{
              width: '100%',
              aspectRatio: 3,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.backgroundElement,
            }}>
            <Icon name="star" color={SightColor} size={48} />
          </View>
        )}

        <View style={{ padding: Spacing.three, gap: Spacing.three }}>
          <View style={{ gap: Spacing.one }}>
            <ThemedText type="subtitle" style={{ fontSize: 26, lineHeight: 32 }} selectable>
              {sight.name}
            </ThemedText>
            {sight.description && (
              <ThemedText themeColor="textSecondary" selectable>
                {sight.description}
              </ThemedText>
            )}
            <ThemedText type="small" themeColor="textSecondary">
              {[
                km !== null ? `${formatKm(km)} away` : null,
                sight.travelerPhotos > 0 ? `${sight.travelerPhotos} traveler photos here` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
          </View>

          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <PrimaryButton
              label="Directions"
              onPress={() => Linking.openURL(directionsUrl(process.env.EXPO_OS, sight.lat, sight.lng))}
            />
            {articleUrl && (
              <PrimaryButton label="Wikipedia" variant="secondary" onPress={() => openInBrowser(articleUrl)} />
            )}
          </View>
          {isHere && (
            <View style={{ flexDirection: 'row' }}>
              <PrimaryButton label="📍 You’re here — post a photo" onPress={() => router.navigate('/capture')} />
            </View>
          )}

          {summary.isPending && sight.wikiTitle ? (
            <ActivityIndicator style={{ alignSelf: 'flex-start' }} />
          ) : summary.data?.extract ? (
            <ThemedText selectable>{summary.data.extract}</ThemedText>
          ) : null}

          <View style={{ gap: Spacing.two, marginTop: Spacing.two }}>
            <ThemedText type="smallBold" style={{ fontSize: 18 }}>
              Travelers’ photos here
            </ThemedText>
            {photos.isPending ? (
              <ActivityIndicator style={{ alignSelf: 'flex-start' }} />
            ) : (photos.data ?? []).length === 0 ? (
              <ThemedText themeColor="textSecondary">
                No traveler photos here yet. Be the first when you visit!
              </ThemedText>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
                {photos.data!.map((p) => (
                  <PhotoTile
                    key={p.id}
                    uri={p.thumbUrl}
                    size={tile}
                    accessibilityLabel={`Traveler photo at ${sight.name}`}
                    onPress={() => router.push({ pathname: '/photo/[photoId]', params: { photoId: p.id } })}
                  />
                ))}
              </View>
            )}
          </View>

          <View style={{ gap: Spacing.one, marginTop: Spacing.three }}>
            <SightsCredit />
            {photoCredit && (
              <ThemedText
                type="small"
                style={{ textAlign: 'center', fontSize: 12, color: BrandColor }}
                onPress={() => openInBrowser(photoCredit)}>
                Photo author and license
              </ThemedText>
            )}
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}
