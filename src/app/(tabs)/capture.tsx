import { CameraView, type CameraType } from 'expo-camera';
import { router, useIsFocused } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraIconButton, ShutterButton } from '@/components/camera-control';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { getCaptureLocation, type CaptureLocation } from '@/features/capture/capture-location';
import { startDraft } from '@/features/capture/draft';
import { PermissionGate } from '@/features/capture/permission-gate';
import { formatCoordinates, formatPlaceLabel } from '@/features/capture/place-name';
import { useCapturePermissions } from '@/features/capture/use-capture-permissions';
import { usePromise, type PromiseState } from '@/hooks/use-promise';

function describeLocation(state: PromiseState<CaptureLocation>): string {
  if (state.status === 'pending') return 'Finding your place…';
  if (state.status === 'rejected') return 'Location unavailable';
  const { place, latitude, longitude } = state.value;
  return place ? formatPlaceLabel(place) : formatCoordinates(latitude, longitude);
}

export default function CaptureScreen() {
  const permissions = useCapturePermissions();
  const isFocused = useIsFocused();

  if (permissions.state !== 'granted') {
    return (
      <PermissionGate
        state={permissions.state}
        cameraGranted={permissions.cameraGranted}
        locationGranted={permissions.locationGranted}
        onRequest={permissions.request}
      />
    );
  }

  // Only run the camera while this tab is visible: saves battery and releases the hardware.
  // Unmounting also resets the camera's "ready" state for the next visit.
  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>{isFocused && <LiveCamera />}</View>
  );
}

function LiveCamera() {
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const insets = useSafeAreaInsets();
  // A quick look-up so the user sees where they are before shooting. Refreshes each time the tab
  // is opened (this component remounts). The photo itself still gets a fresh fix at shutter press.
  const [currentLocation] = useState(getCaptureLocation);
  const located = usePromise(currentLocation);
  const placeLabel = describeLocation(located);

  async function takePhoto() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      startDraft(picture);
      router.push('/capture/preview');
    } catch (e) {
      Alert.alert('Could not take photo', e instanceof Error ? e.message : String(e));
    } finally {
      setCapturing(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing={facing}
        mirror={facing === 'front'}
        onCameraReady={() => setReady(true)}
        onMountError={(e) => Alert.alert('Camera unavailable', e.message)}
      />

      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: insets.top + Spacing.three, left: 0, right: 0 }}>
        <ThemedText
          type="small"
          style={{
            alignSelf: 'center',
            color: 'white',
            paddingHorizontal: Spacing.three,
            paddingVertical: Spacing.one,
            borderRadius: 99,
            overflow: 'hidden',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
          }}>
          📍 {placeLabel}
        </ThemedText>
      </View>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: insets.bottom + BottomTabInset + Spacing.three,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: Spacing.five,
        }}>
        {/* Spacer keeps the shutter centered. */}
        <View style={{ width: 52 }} />
        <ShutterButton onPress={takePhoto} disabled={!ready || capturing} />
        <CameraIconButton
          icon="arrow.triangle.2.circlepath"
          label="Switch camera"
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
        />
      </View>
    </View>
  );
}
