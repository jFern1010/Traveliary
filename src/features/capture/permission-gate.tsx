import { Linking, ScrollView, View } from 'react-native';

import { Icon } from '@/components/icon';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, BrandColor, Spacing } from '@/constants/theme';
import type { CapturePermissionState } from './use-capture-permissions';

type Props = {
  state: Exclude<CapturePermissionState, 'granted'>;
  cameraGranted: boolean;
  locationGranted: boolean;
  onRequest: () => void;
};

function Reason({ granted, title, body }: { granted: boolean; title: string; body: string }) {
  return (
    <ThemedView
      type="backgroundElement"
      style={{ flexDirection: 'row', gap: Spacing.three, padding: Spacing.three, borderRadius: 14 }}>
      <Icon name={granted ? 'checked' : 'unchecked'} color={granted ? '#30A46C' : BrandColor} size={24} />
      <View style={{ flex: 1, gap: Spacing.half }}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {body}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

/** Explains why we need camera + location before the system prompt is shown. */
export function PermissionGate({ state, cameraGranted, locationGranted, onRequest }: Props) {
  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          gap: Spacing.four,
          padding: Spacing.four,
          paddingBottom: BottomTabInset + Spacing.four,
        }}>
        <View style={{ alignItems: 'center', gap: Spacing.two }}>
          <Icon name="viewfinder" color={BrandColor} size={56} />
          <ThemedText type="subtitle" style={{ textAlign: 'center' }}>
            Capture where you are
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
            Traveliary photos are taken live and tagged with the place you took them.
          </ThemedText>
        </View>

        <View style={{ gap: Spacing.two }}>
          <Reason
            granted={cameraGranted}
            title="Camera"
            body="To take your photo or selfie. Nothing is posted without your OK."
          />
          <Reason
            granted={locationGranted}
            title="Location while using the app"
            body="To name the place, like “Zermatt, Switzerland”. Your exact position is never shown to others."
          />
        </View>

        {state === 'blocked' ? (
          <View style={{ gap: Spacing.two }}>
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              Access was turned off. Enable Camera and Location in Settings, then come back.
            </ThemedText>
            <View style={{ flexDirection: 'row' }}>
              <PrimaryButton label="Open Settings" onPress={() => Linking.openSettings()} />
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row' }}>
            <PrimaryButton
              label="Continue"
              onPress={onRequest}
              loading={state === 'loading'}
            />
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}
