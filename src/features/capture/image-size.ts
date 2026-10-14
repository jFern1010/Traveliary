export type Size = { width: number; height: number };

/** Longest side of the uploaded photo and of its gallery thumbnail, in pixels. */
export const FULL_MAX_SIDE = 1600;
export const THUMB_MAX_SIDE = 400;

/** Scales a size down so its longest side fits `maxSide`, keeping the aspect ratio. Never upscales. */
export function fitWithin(size: Size, maxSide: number): Size {
  const longest = Math.max(size.width, size.height);
  if (longest <= maxSide) return { width: size.width, height: size.height };
  const scale = maxSide / longest;
  return {
    width: Math.round(size.width * scale),
    height: Math.round(size.height * scale),
  };
}
