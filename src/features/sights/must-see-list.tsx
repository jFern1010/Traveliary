import { router } from 'expo-router';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyMessage } from '@/components/empty-message';
import { PrimaryButton } from '@/components/primary-button';
import { SightRow } from '@/components/sight-row';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import type { useUserPosition } from '@/features/places/use-user-position';
import type { useNearbySights } from './hooks';

export function openSight(sightId: string) {
  router.push({ pathname: '/sight/[sightId]', params: { sightId } });
}

/** Wikipedia/Wikidata text is CC BY-SA: credit the source wherever it is shown. */
export function SightsCredit() {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', fontSize: 12 }}>
      Places and descriptions: Wikipedia & Wikidata (CC BY-SA). Photos: Wikimedia Commons.
    </ThemedText>
  );
}

type Props = {
  user: ReturnType<typeof useUserPosition>;
  sights: ReturnType<typeof useNearbySights>;
};

export function MustSeeList({ user, sights }: Props) {
  const insets = useSafeAreaInsets();

  let empty;
  if (!user.granted) {
    empty = (
      <EmptyMessage
        title="Discover what’s worth seeing"
        body="Allow location to see the best-known places within 50 km: landmarks, museums, historic sites and nature.">
        {user.canAsk && <PrimaryButton label="Allow location" onPress={user.requestPermission} />}
      </EmptyMessage>
    );
  } else if (sights.isPending && sights.fetchStatus === 'paused') {
    empty = (
      <EmptyMessage
        title="Offline"
        body="Must-see places will load when you’re back online. Areas you’ve opened before still work."
      />
    );
  } else if (!user.position || sights.isPending) {
    empty = (
      <View style={{ paddingTop: Spacing.six, gap: Spacing.three, alignItems: 'center' }}>
        <ActivityIndicator />
        <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
          Finding must-see places near you…{'\n'}The first time in a new area can take up to 30 seconds.
        </ThemedText>
      </View>
    );
  } else if (sights.isError) {
    empty = (
      <EmptyMessage title="Couldn’t load must-see places" body={sights.error.message}>
        <PrimaryButton label="Try again" onPress={() => sights.refetch()} />
      </EmptyMessage>
    );
  } else {
    empty = (
      <EmptyMessage
        title="Nothing well-known nearby"
        body="We couldn’t find famous places within 50 km. Posts from travelers here are on the Map and Nearby."
      />
    );
  }

  return (
    <FlatList
      data={sights.ranked}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{
        gap: Spacing.two,
        paddingHorizontal: Spacing.three,
        paddingTop: insets.top + 64,
        paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
      }}
      renderItem={({ item, index }) => (
        <SightRow sight={item} rank={index + 1} onPress={() => openSight(item.id)} />
      )}
      ListHeaderComponent={
        sights.ranked.length > 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={{ paddingBottom: Spacing.one }}>
            Best-known places within 50 km, ranked by fame, distance and traveler photos.
          </ThemedText>
        ) : null
      }
      ListFooterComponent={sights.ranked.length > 0 ? <View style={{ paddingTop: Spacing.three }}><SightsCredit /></View> : null}
      ListEmptyComponent={empty}
      onRefresh={() => sights.refetch()}
      refreshing={sights.isRefetching}
    />
  );
}
