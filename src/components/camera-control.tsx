import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

/** Liquid glass on iOS 26+, a translucent dark disc on older iOS. */
function GlassSurface({ style, children }: { style: ViewStyle; children: ReactNode }) {
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView isInteractive style={style}>
        {children}
      </GlassView>
    );
  }
  return <View style={[style, { backgroundColor: 'rgba(0, 0, 0, 0.35)' }]}>{children}</View>;
}

export function CameraIconButton({
  icon,
  label,
  onPress,
}: {
  icon: SFSymbol;
  label: string;
  onPress: () => void;
}) {
  return (
    <GlassSurface style={{ borderRadius: 99 }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={8}
        style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
        <SymbolView name={icon} tintColor="white" size={24} />
      </Pressable>
    </GlassSurface>
  );
}

export function ShutterButton({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
  return (
    <GlassSurface style={{ padding: 6, borderRadius: 99 }}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Take photo"
        style={({ pressed }) => ({
          width: 72,
          height: 72,
          borderRadius: 99,
          backgroundColor: 'white',
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        })}
      />
    </GlassSurface>
  );
}
