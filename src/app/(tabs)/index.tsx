import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraIconButton } from '@/components/camera-control';
import { EmptyMessage } from '@/components/empty-message';
import { OfflineBanner } from '@/components/offline-banner';
import { PlaceRow } from '@/components/place-row';
import { PrimaryButton } from '@/components/primary-button';
import { SegmentedPill } from '@/components/segmented-pill';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, BrandColor, SightColor, Spacing } from '@/constants/theme';
import { formatPhotoCount, regionToBounds, type Bounds, type Region } from '@/features/places/geo';
import { usePlacesInBounds, usePlacesNear } from '@/features/places/hooks';
import { useUserPosition, type Position } from '@/features/places/use-user-position';
import { useNearbySights } from '@/features/sights/hooks';
import { formatKm } from '@/features/sights/links';
import { MustSeeList, openSight } from '@/features/sights/must-see-list';
import type { RankedSight } from '@/features/sights/rank';
import { isBackendConfigured } from '@/lib/env';

type Mode = 'map' | 'nearby' | 'mustSee';
const MODES = [
  { value: 'map', label: 'Map' },
  { value: 'nearby', label: 'Nearby' },
  { value: 'mustSee', label: 'Must see' },
] as const;

/** Before we know where the user is: a view over Europe. */
const WORLD_REGION: Region = { latitude: 46, longitude: 8, latitudeDelta: 40, longitudeDelta: 40 };
const CITY_DELTA = 0.2;

function openPlace(placeId: string) {
  router.push({ pathname: '/place/[placeId]', params: { placeId } });
}

export default function ExploreScreen() {
  const [mode, setMode] = useState<Mode>('map');
  const user = useUserPosition();
  // Loaded once for both the "Must see" list and the orange pins on the map.
  const sights = useNearbySights(user.position);
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={{ flex: 1 }}>
      {mode === 'map' ? (
        <PlacesMap position={user.position} showsUser={user.granted} sights={sights.ranked} />
      ) : mode === 'nearby' ? (
        <NearbyList user={user} />
      ) : (
        <MustSeeList user={user} sights={sights} />
      )}
      <View
        style={{ position: 'absolute', top: insets.top + Spacing.two, left: 0, right: 0 }}
        pointerEvents="box-none">
        <SegmentedPill options={MODES} value={mode} onChange={setMode} />
        <OfflineBanner style={{ marginTop: Spacing.two, marginHorizontal: Spacing.three }} />
      </View>
    </ThemedView>
  );
}

function PlacesMap({
  position,
  showsUser,
  sights,
}: {
  position: Position | null;
  showsUser: boolean;
  sights: RankedSight[];
}) {
  const mapRef = useRef<MapView>(null);
  const [bounds, setBounds] = useState<Bounds>(() => regionToBounds(WORLD_REGION));
  const userMovedMap = useRef(false);
  const centeredOnUser = useRef(false);
  const places = usePlacesInBounds(isBackendConfigured ? bounds : null);
  const insets = useSafeAreaInsets();

  // Fly to the user once, when their position first arrives, unless they're already exploring.
  useEffect(() => {
    if (!position || centeredOnUser.current || userMovedMap.current) return;
    centeredOnUser.current = true;
    mapRef.current?.animateToRegion(
      { ...position, latitudeDelta: CITY_DELTA, longitudeDelta: CITY_DELTA },
      600,
    );
  }, [position]);

  function recenter() {
    if (!position) return;
    mapRef.current?.animateToRegion(
      { ...position, latitudeDelta: CITY_DELTA, longitudeDelta: CITY_DELTA },
      400,
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={
          position ? { ...position, latitudeDelta: CITY_DELTA, longitudeDelta: CITY_DELTA } : WORLD_REGION
        }
        showsUserLocation={showsUser}
        showsCompass={false}
        onRegionChangeComplete={(region, details) => {
          if (details?.isGesture) userMovedMap.current = true;
          setBounds(regionToBounds(region));
        }}>
        {places.data?.map((place) => (
          <Marker
            key={place.id}
            coordinate={{ latitude: place.latitude, longitude: place.longitude }}
            title={place.name}
            description={`${formatPhotoCount(place.photoCount)} · Tap to open`}
            pinColor={BrandColor}
            onCalloutPress={() => openPlace(place.id)}
          />
        ))}
        {sights.map((sight) => (
          <Marker
            key={`sight-${sight.id}`}
            coordinate={{ latitude: sight.lat, longitude: sight.lng }}
            title={`★ ${sight.name}`}
            description={`Must see · ${formatKm(sight.distanceKm)} · Tap for details`}
            pinColor={SightColor}
            onCalloutPress={() => openSight(sight.id)}
          />
        ))}
      </MapView>

      {!isBackendConfigured && (
        <Banner text="Backend not connected. Add your Supabase keys to .env.local." />
      )}
      {places.isError && <Banner text={`Couldn’t load places: ${places.error.message}`} />}

      <View
        style={{
          position: 'absolute',
          right: Spacing.three,
          bottom: insets.bottom + BottomTabInset + Spacing.three,
          alignItems: 'center',
          gap: Spacing.two,
        }}>
        {places.isFetching && <ActivityIndicator />}
        {position && <CameraIconButton icon="myLocation" label="Show my location" onPress={recenter} />}
      </View>
    </View>
  );
}

function Banner({ text }: { text: string }) {
  const insets = useSafeAreaInsets();
  return (
    <ThemedView
      type="backgroundElement"
      style={{
        position: 'absolute',
        top: insets.top + 60,
        left: Spacing.three,
        right: Spacing.three,
        padding: Spacing.three,
        borderRadius: 12,
      }}>
      <ThemedText type="small" selectable>
        {text}
      </ThemedText>
    </ThemedView>
  );
}

function NearbyList({ user }: { user: ReturnType<typeof useUserPosition> }) {
  const places = usePlacesNear(user.position);
  const insets = useSafeAreaInsets();

  let empty: ReactNode;
  if (!user.granted) {
    empty = (
      <EmptyMessage
        title="See what’s around you"
        body="Allow location to find places near you that travelers have posted from.">
        {user.canAsk && <PrimaryButton label="Allow location" onPress={user.requestPermission} />}
      </EmptyMessage>
    );
  } else if (places.isPending && places.fetchStatus === 'paused') {
    empty = (
      <EmptyMessage
        title="Offline"
        body="Nearby places will load when you’re back online. Places you opened before still work."
      />
    );
  } else if (!user.position || places.isPending) {
    empty = <ActivityIndicator style={{ marginTop: Spacing.six }} />;
  } else if (places.isError) {
    empty = (
      <EmptyMessage title="Couldn’t load nearby places" body={places.error.message}>
        <PrimaryButton label="Try again" onPress={() => places.refetch()} />
      </EmptyMessage>
    );
  } else {
    empty = (
      <EmptyMessage
        title="No posts nearby yet"
        body="Nobody has posted within 50 km. Be the first!">
        <PrimaryButton label="Open camera" onPress={() => router.navigate('/capture')} />
      </EmptyMessage>
    );
  }

  return (
    <FlatList
      data={places.data ?? []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{
        gap: Spacing.two,
        paddingHorizontal: Spacing.three,
        paddingTop: insets.top + 64,
        paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
      }}
      renderItem={({ item }) => <PlaceRow place={item} onPress={() => openPlace(item.id)} />}
      ListEmptyComponent={empty}
      onRefresh={() => places.refetch()}
      refreshing={places.isRefetching}
    />
  );
}
