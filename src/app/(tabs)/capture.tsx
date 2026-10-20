import { CameraView, type CameraType } from 'expo-camera';
import { router, useIsFocused } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraIconButton, ShutterButton } from '@/components/camera-control';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import {
  findUltraWideLens,
  nextFlash,
  nextZoom,
  type FlashMode,
} from '@/features/capture/camera-controls';
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
  const [zoom, setZoom] = useState(0);
  const [flash, setFlash] = useState<FlashMode>('off');
  const [showGrid, setShowGrid] = useState(false);
  const [lenses, setLenses] = useState<string[]>([]);
  const [useUltraWide, setUseUltraWide] = useState(false);
  const [pinchStartZoom, setPinchStartZoom] = useState(0);
  const insets = useSafeAreaInsets();
  // A quick look-up so the user sees where they are before shooting. Refreshes each time the tab
  // is opened (this component remounts). The photo itself still gets a fresh fix at shutter press.
  const [currentLocation] = useState(getCaptureLocation);
  const located = usePromise(currentLocation);
  const placeLabel = describeLocation(located);

  const isBack = facing === 'back';
  // 0.5× is a separate physical lens (iOS only), not digital zoom, so its label is exact.
  const ultraWideLens = isBack && process.env.EXPO_OS === 'ios' ? findUltraWideLens(lenses) : null;
  const flashIcon = flash === 'off' ? 'flashOff' : flash === 'auto' ? 'flashAuto' : 'flashOn';

  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => setPinchStartZoom(zoom))
    .onUpdate((e) => setZoom(nextZoom(pinchStartZoom, e.scale, process.env.EXPO_OS)));

  function switchCamera() {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
    setZoom(0);
    setUseUltraWide(false);
    setLenses([]);
    setReady(false);
  }

  function selectLens(ultra: boolean) {
    setUseUltraWide(ultra);
    setZoom(0);
  }

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
      <GestureDetector gesture={pinch}>
        <View style={{ flex: 1 }} collapsable={false}>
          <CameraView
            ref={cameraRef}
            style={{ flex: 1 }}
            facing={facing}
            mirror={facing === 'front'}
            zoom={zoom}
            flash={isBack ? flash : 'off'}
            selectedLens={useUltraWide && ultraWideLens ? ultraWideLens : undefined}
            onAvailableLensesChanged={(e) => setLenses(e.lenses)}
            onCameraReady={() => setReady(true)}
            onMountError={(e) => Alert.alert('Camera unavailable', e.message)}
          />
          {showGrid && <ThirdsGrid />}
        </View>
      </GestureDetector>

      <View
        style={{
          position: 'absolute',
          top: insets.top + Spacing.two,
          left: Spacing.three,
          right: Spacing.three,
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.two,
        }}>
        {isBack ? (
          <CameraIconButton icon={flashIcon} label={`Flash: ${flash}`} onPress={() => setFlash(nextFlash)} />
        ) : (
          <View style={{ width: 52 }} />
        )}
        <View style={{ flex: 1, alignItems: 'center' }} pointerEvents="none">
          <ThemedText
            type="small"
            numberOfLines={1}
            style={{
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
        <CameraIconButton
          icon="grid"
          label={showGrid ? 'Hide grid' : 'Show grid'}
          onPress={() => setShowGrid((g) => !g)}
        />
      </View>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: insets.bottom + BottomTabInset + Spacing.three,
          gap: Spacing.three,
        }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: Spacing.two }}>
          {ultraWideLens && (
            <ZoomChip label="0.5×" active={useUltraWide && zoom === 0} onPress={() => selectLens(true)} />
          )}
          <ZoomChip
            label={zoom > 0 ? 'Reset' : '1×'}
            active={!useUltraWide && zoom === 0}
            onPress={() => selectLens(false)}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: Spacing.five,
          }}>
          {/* Spacer keeps the shutter centered. */}
          <View style={{ width: 52 }} />
          <ShutterButton onPress={takePhoto} disabled={!ready || capturing} />
          <CameraIconButton icon="switchCamera" label="Switch camera" onPress={switchCamera} />
        </View>
      </View>
    </View>
  );
}

function ZoomChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label === 'Reset' ? 'Reset zoom' : `Zoom ${label}`}
      hitSlop={8}
      style={{
        minWidth: 44,
        height: 32,
        paddingHorizontal: Spacing.two,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
      }}>
      <ThemedText type="smallBold" style={{ color: active ? '#FFD60A' : 'white', fontSize: 13 }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Rule-of-thirds overlay to help framing. */
function ThirdsGrid() {
  const line = { position: 'absolute' as const, backgroundColor: 'rgba(255, 255, 255, 0.45)' };
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <View style={[line, { left: '33.33%', top: 0, bottom: 0, width: 1 }]} />
      <View style={[line, { left: '66.66%', top: 0, bottom: 0, width: 1 }]} />
      <View style={[line, { top: '33.33%', left: 0, right: 0, height: 1 }]} />
      <View style={[line, { top: '66.66%', left: 0, right: 0, height: 1 }]} />
    </View>
  );
}
