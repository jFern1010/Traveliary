import Constants from 'expo-constants';
import { router } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import * as Updates from 'expo-updates';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { APP_NAME, SUPPORT_EMAIL } from '@/constants/app-info';
import { BrandColor, Spacing } from '@/constants/theme';
import { deleteMyAccount } from '@/features/account/delete-account';
import { useBlockCount, useUnblockAll } from '@/features/moderation/api';
import { useTheme } from '@/hooks/use-theme';

const DANGER = '#E5484D';

function versionLabel(): string {
  const version = Constants.expoConfig?.version ?? '?';
  const update = Updates.updateId ? ` · update ${Updates.updateId.slice(0, 8)}` : '';
  return `${version}${update}`;
}

function sendFeedback() {
  const subject = encodeURIComponent(`${APP_NAME} beta feedback`);
  const body = encodeURIComponent(`\n\n—\nApp version: ${versionLabel()}`);
  Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() =>
    Alert.alert('No email app', `Please write to ${SUPPORT_EMAIL}.`),
  );
}

export default function AboutScreen() {
  const blocks = useBlockCount();
  const unblock = useUnblockAll();
  const [deleting, setDeleting] = useState(false);

  function confirmUnblock() {
    Alert.alert('Unblock everyone?', 'Photos from travelers you blocked will appear again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock all',
        onPress: () => unblock.mutate(undefined, { onError: (e) => Alert.alert('Couldn’t unblock', e.message) }),
      },
    ]);
  }

  function confirmDelete() {
    Alert.alert(
      'Delete all your data?',
      'This permanently deletes every photo you posted, your reports and blocks, and your anonymous identity. It can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteMyAccount();
              router.dismissAll();
              router.replace('/');
              Alert.alert('Deleted', 'Your photos and identity are gone. You’re starting fresh.');
            } catch (e) {
              Alert.alert('Couldn’t delete', e instanceof Error ? e.message : String(e));
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  const blockCount = blocks.data ?? 0;

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six }}>
        <Group title="Help">
          <Row icon="envelope" label="Send feedback" detail={SUPPORT_EMAIL} onPress={sendFeedback} />
          <Row
            icon="doc.text"
            label="Terms of Use"
            onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })}
          />
          <Row
            icon="hand.raised"
            label="Privacy Policy"
            onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })}
          />
        </Group>

        <Group title="Safety">
          <Row
            icon="person.crop.circle.badge.xmark"
            label="Blocked travelers"
            detail={blocks.isPending ? '…' : String(blockCount)}
            actionLabel={blockCount > 0 ? 'Unblock all' : undefined}
            onPress={blockCount > 0 ? confirmUnblock : undefined}
          />
        </Group>

        <Group title="Your data">
          <Row
            icon="trash"
            label={deleting ? 'Deleting…' : 'Delete my photos and identity'}
            tint={DANGER}
            busy={deleting}
            onPress={deleting ? undefined : confirmDelete}
          />
        </Group>

        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }} selectable>
          {APP_NAME} {versionLabel()}
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: Spacing.two }}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={{ textTransform: 'uppercase', fontSize: 12 }}>
        {title}
      </ThemedText>
      <ThemedView type="backgroundElement" style={{ borderRadius: 14, borderCurve: 'continuous', overflow: 'hidden' }}>
        {children}
      </ThemedView>
    </View>
  );
}

function Row({
  icon,
  label,
  detail,
  actionLabel,
  tint,
  busy,
  onPress,
}: {
  icon: SFSymbol;
  label: string;
  detail?: string;
  actionLabel?: string;
  tint?: string;
  busy?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.three,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.three,
        opacity: pressed ? 0.6 : 1,
      })}>
      {busy ? (
        <ActivityIndicator />
      ) : (
        <SymbolView name={icon} tintColor={tint ?? BrandColor} size={20} />
      )}
      <ThemedText style={{ flex: 1, color: tint ?? theme.text }}>{label}</ThemedText>
      {detail && (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={{ maxWidth: '50%' }}>
          {detail}
        </ThemedText>
      )}
      {actionLabel && (
        <ThemedText type="smallBold" style={{ color: BrandColor }}>
          {actionLabel}
        </ThemedText>
      )}
    </Pressable>
  );
}
