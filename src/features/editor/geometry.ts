/**
 * Crop/rotate/flip geometry shared by the editor's on-screen preview and the final export, so what
 * you see in the frame is exactly what gets saved.
 *
 * Order of operations (both on screen and in expo-image-manipulator): flip → rotate → crop.
 * Pan is stored normalized (−1…1 per axis, 0 = centered) so it doesn't depend on screen size.
 */

export type AspectPreset = 'original' | 'square' | '4:5' | '16:9';
export type Rotation = 0 | 90 | 180 | 270;

export type CropState = {
  aspect: AspectPreset;
  rotation: Rotation;
  flipped: boolean;
  /** ≥ 1: how far the user zoomed into the frame. */
  scale: number;
  /** Normalized pan, −1…1. Positive x moves the image right (shows more of its left side). */
  panX: number;
  panY: number;
};

export const DEFAULT_CROP: CropState = { aspect: 'original', rotation: 0, flipped: false, scale: 1, panX: 0, panY: 0 };
export const MAX_CROP_SCALE = 4;

export type Size = { width: number; height: number };
export type Rect = { originX: number; originY: number; width: number; height: number };

export const ASPECT_LABELS: Record<AspectPreset, string> = {
  original: 'Original',
  square: 'Square',
  '4:5': '4:5',
  '16:9': '16:9',
};

/** Image size after rotation. */
export function rotatedSize(size: Size, rotation: Rotation): Size {
  return rotation === 90 || rotation === 270 ? { width: size.height, height: size.width } : size;
}

/** Width ÷ height of the crop frame. "Original" keeps the (rotated) photo's own shape. */
export function frameAspect(aspect: AspectPreset, rotated: Size): number {
  switch (aspect) {
    case 'square':
      return 1;
    case '4:5':
      return 4 / 5;
    case '16:9':
      return 16 / 9;
    default:
      return rotated.width / rotated.height;
  }
}

export function nextRotation(rotation: Rotation): Rotation {
  return ((rotation + 90) % 360) as Rotation;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function clampCrop(state: CropState): CropState {
  return {
    ...state,
    scale: clamp(state.scale, 1, MAX_CROP_SCALE),
    panX: clamp(state.panX, -1, 1),
    panY: clamp(state.panY, -1, 1),
  };
}

/**
 * The crop rectangle in pixels of the flipped+rotated image.
 * At scale 1 it is the largest rectangle of the frame's aspect that fits; zooming shrinks it;
 * panning moves it within the leftover room ("slack").
 */
export function cropRect(source: Size, state: CropState): Rect {
  const s = clampCrop(state);
  const img = rotatedSize(source, s.rotation);
  const ratio = frameAspect(s.aspect, img);

  let width: number;
  let height: number;
  if (img.width / img.height > ratio) {
    height = img.height;
    width = height * ratio;
  } else {
    width = img.width;
    height = width / ratio;
  }
  width /= s.scale;
  height /= s.scale;

  const slackX = (img.width - width) / 2;
  const slackY = (img.height - height) / 2;
  const centerX = img.width / 2 - s.panX * slackX;
  const centerY = img.height / 2 - s.panY * slackY;

  const originX = Math.round(clamp(centerX - width / 2, 0, img.width - width));
  const originY = Math.round(clamp(centerY - height / 2, 0, img.height - height));
  return {
    originX,
    originY,
    width: Math.min(Math.round(width), img.width - originX),
    height: Math.min(Math.round(height), img.height - originY),
  };
}

/** True when the crop changes nothing (no need to re-encode for cropping). */
export function isIdentityCrop(state: CropState): boolean {
  return (
    state.aspect === 'original' &&
    state.rotation === 0 &&
    !state.flipped &&
    state.scale === 1 &&
    state.panX === 0 &&
    state.panY === 0
  );
}

/**
 * On-screen layout of the (flipped+rotated) image inside a frame of `frame` size: the image
 * "covers" the frame at scale 1, times the user's zoom. Returns its displayed size and the
 * maximum translation per axis (for converting gesture pixels ⇄ normalized pan).
 */
export function displayLayout(source: Size, state: CropState, frame: Size) {
  const img = rotatedSize(source, state.rotation);
  const cover = Math.max(frame.width / img.width, frame.height / img.height) * clamp(state.scale, 1, MAX_CROP_SCALE);
  const width = img.width * cover;
  const height = img.height * cover;
  return {
    width,
    height,
    maxTranslateX: Math.max(0, (width - frame.width) / 2),
    maxTranslateY: Math.max(0, (height - frame.height) / 2),
  };
}

/** Largest frame of `aspect` that fits in the available area. */
export function fitFrame(aspect: number, area: Size): Size {
  if (area.width / area.height > aspect) {
    return { width: area.height * aspect, height: area.height };
  }
  return { width: area.width, height: area.width / aspect };
}
