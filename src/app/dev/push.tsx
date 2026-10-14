import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { registerForPushToken, type PushRegistration } from '@/features/notifications/register';
import { sendTestPush } from '@/features/notifications/test-push';

/** M0 feasibility check: can Expo Go on this iPhone receive remote push notifications? */
export default function PushTestScreen() {
  const [registration, setRegistration] = useState<PushRegistration | null>(null);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onRegister() {
    setBusy(true);
    const result = await registerForPushToken();
    if (result.status === 'granted') {
      console.log('Expo push token:', result.token);
    }
    setRegistration(result);
    setBusy(false);
  }

  async function onSend(token: string) {
    setBusy(true);
    try {
      setSendResult(await sendTestPush(token));
    } catch (e) {
      setSendResult(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Button label="1. Get push token" onPress={onRegister} disabled={busy} />

        {registration && (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Status: {registration.status}</ThemedText>
            {registration.status === 'granted' && (
              <ThemedText type="code" selectable>
                {registration.token}
              </ThemedText>
            )}
            {registration.status === 'unsupported' && (
              <ThemedText type="small">{registration.reason}</ThemedText>
            )}
            {registration.status === 'error' && (
              <ThemedText type="small">{registration.message}</ThemedText>
            )}
            {registration.status === 'denied' && (
              <ThemedText type="small">
                Notifications are off. Enable them in Settings → Expo Go → Notifications.
              </ThemedText>
            )}
          </ThemedView>
        )}

        {registration?.status === 'granted' && (
          <Button
            label="2. Send me a test push"
            onPress={() => onSend(registration.token)}
            disabled={busy}
          />
        )}

        {sendResult && (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Expo Push Service replied:</ThemedText>
            <ThemedText type="code" selectable>
              {sendResult}
            </ThemedText>
          </ThemedView>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function Button({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, (pressed || disabled) && styles.buttonDimmed]}>
      <ThemedText style={styles.buttonLabel}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  button: {
    backgroundColor: '#208AEF',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  buttonDimmed: { opacity: 0.6 },
  buttonLabel: { color: '#ffffff' },
});
