import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, Pressable, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { BrandColor, Spacing } from '@/constants/theme';
import { getDraft, setDraftEdit, subscribeDraft } from '@/features/capture/draft';
import { applyEdits } from '@/features/editor/apply-edits';
import { DEFAULT_EDITS, isUnedited, type EditState } from '@/features/editor/edit-state';
import {
  ASPECT_LABELS,
  clampCrop,
  displayLayout,
  fitFrame,
  frameAspect,
  nextRotation,
  rotatedSize,
  type AspectPreset,
  type CropState,
  type Size,
} from '@/features/editor/geometry';
import { usePromise } from '@/hooks/use-promise';

const ASPECTS: AspectPreset[] = ['original', 'square', '4:5', '16:9'];

export default function EditScreen() {
  const draft = useSyncExternalStore(subscribeDraft, getDraft);
  // Lock onto the draft that opened the editor, even if the store changes underneath.
  const [draftId] = useState(() => draft?.id ?? null);
  const source = usePromise(draft?.id === draftId ? (draft?.photo ?? null) : null);
  const [edits, setEdits] = useState<EditState>(() => draft?.edited?.edits ?? DEFAULT_EDITS);
  const [area, setArea] = useState<Size | null>(null);
  const [gestureStart, setGestureStart] = useState<CropState | null>(null);
  const [saving, setSaving] = useState(false);
  const insets = useSafeAreaInsets();

  const crop = edits.crop;
  const setCrop = (next: CropState) => setEdits((e) => ({ ...e, crop: clampCrop(next) }));

  if (!draft || draft.id !== draftId) {
    return (
      <View style={{ flex: 1, backgroundColor: 'black', alignItems: 'center', justifyContent: 'center' }}>
        <ThemedText style={{ color: 'white' }}>This photo is no longer available.</ThemedText>
      </View>
    );
  }

  const photo = source.status === 'fulfilled' ? source.value.full : null;
  const imageSize: Size | null = photo ? { width: photo.width, height: photo.height } : null;
  const frame =
    imageSize && area ? fitFrame(frameAspect(crop.aspect, rotatedSize(imageSize, crop.rotation)), area) : null;
  const layout = imageSize && frame ? displayLayout(imageSize, crop, frame) : null;

  // Pan and pinch run together; both start from the crop as it was when the gesture began.
  const pan = Gesture.Pan()
    .runOnJS(true)
    .onStart(() => setGestureStart(crop))
    .onUpdate((e) => {
      if (!gestureStart || !imageSize || !frame) return;
      const start = displayLayout(imageSize, gestureStart, frame);
      setCrop({
        ...crop,
        panX: start.maxTranslateX ? gestureStart.panX + e.translationX / start.maxTranslateX : 0,
        panY: start.maxTranslateY ? gestureStart.panY + e.translationY / start.maxTranslateY : 0,
      });
    });
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => setGestureStart(crop))
    .onUpdate((e) => {
      if (!gestureStart) return;
      setCrop({ ...crop, scale: gestureStart.scale * e.scale });
    });
  const gestures = Gesture.Simultaneous(pan, pinch);

  async function done() {
    if (!photo || !draftId) return;
    if (isUnedited(edits)) {
      setDraftEdit(draftId, null);
      router.back();
      return;
    }
    setSaving(true);
    try {
      const edited = await applyEdits(photo, edits);
      setDraftEdit(draftId, { photo: edited, edits });
      router.back();
    } catch (e) {
      setSaving(false);
      Alert.alert('Couldn’t apply edits', e instanceof Error ? e.message : String(e));
    }
  }

  // The image is drawn unrotated, then flipped → rotated → moved, matching the export order.
  const sideways = crop.rotation === 90 || crop.rotation === 270;
  const drawn = layout ? (sideways ? { width: layout.height, height: layout.width } : layout) : null;

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      <Stack.Screen
        options={{
          title: 'Edit',
          headerLeft: () => (
            <HeaderButton label="Cancel" onPress={() => router.back()} disabled={saving} />
          ),
          headerRight: () => <HeaderButton label="Done" bold onPress={done} disabled={!photo || saving} />,
        }}
      />

      <View
        style={{ flex: 1, margin: Spacing.three, alignItems: 'center', justifyContent: 'center' }}
        onLayout={(e: LayoutChangeEvent) => setArea(e.nativeEvent.layout)}>
        {!photo || !frame || !layout || !drawn ? (
          <ActivityIndicator color="white" />
        ) : (
          <GestureDetector gesture={gestures}>
            <View
              collapsable={false}
              accessibilityLabel="Crop frame. Drag to move the photo, pinch to zoom."
              style={{ width: frame.width, height: frame.height, overflow: 'hidden' }}>
              <Image
                source={{ uri: photo.uri }}
                contentFit="fill"
                style={{
                  position: 'absolute',
                  width: drawn.width,
                  height: drawn.height,
                  left: (frame.width - drawn.width) / 2,
                  top: (frame.height - drawn.height) / 2,
                  transform: [
                    { translateX: crop.panX * layout.maxTranslateX },
                    { translateY: crop.panY * layout.maxTranslateY },
                    { rotate: `${crop.rotation}deg` },
                    { scaleX: crop.flipped ? -1 : 1 },
                  ],
                }}
              />
              <ThirdsGrid />
            </View>
          </GestureDetector>
        )}
      </View>

      <View style={{ gap: Spacing.three, paddingBottom: insets.bottom + Spacing.three, paddingTop: Spacing.two }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: Spacing.two }}>
          {ASPECTS.map((aspect) => (
            <Chip
              key={aspect}
              label={ASPECT_LABELS[aspect]}
              active={crop.aspect === aspect}
              onPress={() => setCrop({ ...crop, aspect, scale: 1, panX: 0, panY: 0 })}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: Spacing.five }}>
          <ToolButton icon="rotate" label="Rotate" onPress={() => setCrop({ ...crop, rotation: nextRotation(crop.rotation), panX: 0, panY: 0 })} />
          <ToolButton icon="flip" label="Flip" onPress={() => setCrop({ ...crop, flipped: !crop.flipped })} />
          <ToolButton icon="reset" label="Reset" onPress={() => setEdits(DEFAULT_EDITS)} />
        </View>
      </View>

      {saving && (
        <View
          style={{
            position: 'absolute',
            inset: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          }}>
          <ActivityIndicator color="white" size="large" />
        </View>
      )}
    </View>
  );
}

function HeaderButton({
  label,
  onPress,
  bold,
  disabled,
}: {
  label: string;
  onPress: () => void;
  bold?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={10} accessibilityRole="button">
      <ThemedText
        type={bold ? 'smallBold' : 'default'}
        style={{ color: BrandColor, fontSize: 17, opacity: disabled ? 0.4 : 1 }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
        borderRadius: 99,
        backgroundColor: active ? 'white' : 'rgba(255, 255, 255, 0.15)',
      }}>
      <ThemedText type="smallBold" style={{ color: active ? 'black' : 'white' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function ToolButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ alignItems: 'center', gap: Spacing.one, opacity: pressed ? 0.6 : 1 })}>
      <Icon name={icon} color="white" size={24} />
      <ThemedText type="small" style={{ color: 'white', fontSize: 12 }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function ThirdsGrid() {
  const line = { position: 'absolute' as const, backgroundColor: 'rgba(255, 255, 255, 0.35)' };
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
      <View style={[line, { left: '33.33%', top: 0, bottom: 0, width: 1 }]} />
      <View style={[line, { left: '66.66%', top: 0, bottom: 0, width: 1 }]} />
      <View style={[line, { top: '33.33%', left: 0, right: 0, height: 1 }]} />
      <View style={[line, { top: '66.66%', left: 0, right: 0, height: 1 }]} />
    </View>
  );
}
