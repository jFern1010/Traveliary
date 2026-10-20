import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import type { ColorValue } from 'react-native';

/**
 * Every icon the app uses, as an SF Symbol (iOS) + Material Symbol (Android) pair.
 * SymbolView renders nothing on Android for a plain SF Symbol name, so always go through <Icon>.
 */
const ICONS = {
  info: { ios: 'info.circle', android: 'info' },
  globe: { ios: 'globe', android: 'public' },
  world: { ios: 'globe.europe.africa.fill', android: 'public' },
  mapPin: { ios: 'mappin.and.ellipse', android: 'location_on' },
  locationOff: { ios: 'location.slash.fill', android: 'location_off' },
  myLocation: { ios: 'location.fill', android: 'my_location' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right' },
  hidden: { ios: 'eye.slash', android: 'visibility_off' },
  switchCamera: { ios: 'arrow.triangle.2.circlepath', android: 'cameraswitch' },
  camera: { ios: 'camera.fill', android: 'photo_camera' },
  viewfinder: { ios: 'camera.viewfinder', android: 'center_focus_strong' },
  offline: { ios: 'wifi.slash', android: 'wifi_off' },
  photo: { ios: 'photo', android: 'photo' },
  checked: { ios: 'checkmark.circle.fill', android: 'check_circle' },
  unchecked: { ios: 'circle', android: 'radio_button_unchecked' },
  mail: { ios: 'envelope', android: 'mail' },
  document: { ios: 'doc.text', android: 'description' },
  privacy: { ios: 'hand.raised', android: 'front_hand' },
  kind: { ios: 'hand.raised.fill', android: 'front_hand' },
  lock: { ios: 'lock.fill', android: 'lock' },
  blocked: { ios: 'person.crop.circle.badge.xmark', android: 'person_off' },
  trash: { ios: 'trash', android: 'delete' },
  star: { ios: 'star.fill', android: 'star' },
  flashOff: { ios: 'bolt.slash.fill', android: 'flash_off' },
  flashAuto: { ios: 'bolt.badge.automatic.fill', android: 'flash_auto' },
  flashOn: { ios: 'bolt.fill', android: 'flash_on' },
  grid: { ios: 'squareshape.split.3x3', android: 'grid_on' },
  edit: { ios: 'slider.horizontal.3', android: 'tune' },
  rotate: { ios: 'rotate.right', android: 'rotate_right' },
  flip: { ios: 'arrow.left.and.right.righttriangle.left.righttriangle.right', android: 'flip' },
  reset: { ios: 'arrow.counterclockwise', android: 'restart_alt' },
  directions: { ios: 'arrow.triangle.turn.up.right.diamond.fill', android: 'directions' },
  article: { ios: 'book', android: 'menu_book' },
  openExternal: { ios: 'arrow.up.right.square', android: 'open_in_new' },
} as const satisfies Record<string, { ios: SFSymbol; android: AndroidSymbol }>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 24, color }: { name: IconName; size?: number; color?: ColorValue }) {
  return <SymbolView name={ICONS[name]} size={size} tintColor={color} />;
}
