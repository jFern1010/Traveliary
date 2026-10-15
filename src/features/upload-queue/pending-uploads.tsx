import { Image } from 'expo-image';
import { Alert, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColor, Spacing } from '@/constants/theme';
import { formatCoordinates, formatPlaceLabel } from '@/features/capture/place-name';
import { useIsOnline } from '@/lib/connectivity';
import type { QueueItem } from './db';
import { useUploadQueue } from './hooks';
import { queueFile, remove, retry } from './queue';
import { describeStatus } from './queue-state';

/** "Waiting to upload" list at the top of My Trips. Renders nothing when the queue is empty. */
export function PendingUploads() {
  const items = useUploadQueue();
  const online = useIsOnline();
  if (items.length === 0) return null;

  return (
    <View style={{ gap: Spacing.two, paddingBottom: Spacing.three }}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {items.length === 1 ? '1 photo waiting to post' : `${items.length} photos waiting to post`}
      </ThemedText>
      {items.map((item) => (
        <PendingRow key={item.id} item={item} online={online} />
      ))}
    </View>
  );
}

function PendingRow({ item, online }: { item: QueueItem; online: boolean }) {
  const label = item.place
    ? formatPlaceLabel(item.place)
    : formatCoordinates(item.latitude, item.longitude);
  const failed = item.status === 'failed';

  function confirmRemove() {
    Alert.alert('Discard this photo?', 'It hasn’t been posted yet and will be deleted from this phone.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => void remove(item.id) },
    ]);
  }

  return (
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
      <Image
        source={{ uri: queueFile(item.thumbFile).uri }}
        style={{ width: 56, height: 56, borderRadius: 8, opacity: item.status === 'uploading' ? 0.6 : 1 }}
        contentFit="cover"
      />
      <View style={{ flex: 1, gap: Spacing.half }}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {label}
        </ThemedText>
        <ThemedText
          type="small"
          themeColor={failed ? undefined : 'textSecondary'}
          style={failed ? { color: '#E5484D' } : undefined}
          numberOfLines={2}
          selectable>
          {describeStatus(item, online)}
        </ThemedText>
      </View>
      {item.status !== 'uploading' && (
        <View style={{ gap: Spacing.one, alignItems: 'flex-end' }}>
          <Pressable onPress={() => void retry(item.id)} hitSlop={8} accessibilityRole="button">
            <ThemedText type="smallBold" style={{ color: BrandColor }}>
              {failed ? 'Retry' : 'Post now'}
            </ThemedText>
          </Pressable>
          <Pressable onPress={confirmRemove} hitSlop={8} accessibilityRole="button">
            <ThemedText type="small" themeColor="textSecondary">
              Discard
            </ThemedText>
          </Pressable>
        </View>
      )}
    </ThemedView>
  );
}
