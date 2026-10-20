/**
 * Filters and adjustments as 4×5 color matrices (row-major, 20 numbers; Skia's format).
 * Rows produce R, G, B, A from (r, g, b, a, 1); the 5th column is an offset in 0–1 units.
 * One combined matrix is used for the on-screen preview, the filter thumbnails and the export,
 * so all three always match.
 */

export type ColorMatrix = number[];

export type FilterId = 'original' | 'vivid' | 'warm' | 'cool' | 'mono' | 'noir' | 'fade' | 'vintage';

export type Adjustments = {
  /** Each −1…1, 0 = unchanged. */
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
};

export const NO_ADJUSTMENTS: Adjustments = { brightness: 0, contrast: 0, saturation: 0, warmth: 0 };

export const IDENTITY: ColorMatrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

// Rec. 709 luminance weights, used for saturation and grayscale.
const LR = 0.2126;
const LG = 0.7152;
const LB = 0.0722;

/** Result applies `inner` first, then `outer`. */
export function compose(outer: ColorMatrix, inner: ColorMatrix): ColorMatrix {
  const out: number[] = new Array(20).fill(0);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      let sum = col === 4 ? outer[row * 5 + 4] : 0;
      for (let k = 0; k < 4; k++) sum += outer[row * 5 + k] * inner[k * 5 + col];
      out[row * 5 + col] = sum;
    }
  }
  return out;
}

/** Blends two matrices: t = 0 → a, t = 1 → b. */
export function mix(a: ColorMatrix, b: ColorMatrix, t: number): ColorMatrix {
  return a.map((v, i) => v + (b[i] - v) * t);
}

export function brightness(amount: number): ColorMatrix {
  const o = amount * 0.25;
  return [1, 0, 0, 0, o, 0, 1, 0, 0, o, 0, 0, 1, 0, o, 0, 0, 0, 1, 0];
}

export function contrast(amount: number): ColorMatrix {
  const k = 1 + amount * 0.6;
  const t = (1 - k) / 2;
  return [k, 0, 0, 0, t, 0, k, 0, 0, t, 0, 0, k, 0, t, 0, 0, 0, 1, 0];
}

export function saturation(amount: number): ColorMatrix {
  const s = Math.max(0, 1 + amount);
  const r = (1 - s) * LR;
  const g = (1 - s) * LG;
  const b = (1 - s) * LB;
  return [r + s, g, b, 0, 0, r, g + s, b, 0, 0, r, g, b + s, 0, 0, 0, 0, 0, 1, 0];
}

/** Positive = warmer (more red/yellow, less blue). */
export function warmth(amount: number): ColorMatrix {
  const o = amount * 0.08;
  return [1, 0, 0, 0, o, 0, 1, 0, 0, o / 2, 0, 0, 1, 0, -o, 0, 0, 0, 1, 0];
}

const SEPIA: ColorMatrix = [
  0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0,
];

function chain(...matrices: ColorMatrix[]): ColorMatrix {
  // chain(a, b, c) applies a, then b, then c.
  return matrices.reduce((acc, m) => compose(m, acc), IDENTITY);
}

export const FILTERS: { id: FilterId; label: string; matrix: ColorMatrix }[] = [
  { id: 'original', label: 'Original', matrix: IDENTITY },
  { id: 'vivid', label: 'Vivid', matrix: chain(saturation(0.45), contrast(0.2)) },
  { id: 'warm', label: 'Warm', matrix: chain(warmth(0.8), saturation(0.1)) },
  { id: 'cool', label: 'Cool', matrix: chain(warmth(-0.8), saturation(-0.05)) },
  { id: 'mono', label: 'Mono', matrix: saturation(-1) },
  { id: 'noir', label: 'Noir', matrix: chain(saturation(-1), contrast(0.6), brightness(-0.1)) },
  { id: 'fade', label: 'Fade', matrix: chain(contrast(-0.45), brightness(0.12), saturation(-0.25)) },
  { id: 'vintage', label: 'Vintage', matrix: chain(mix(IDENTITY, SEPIA, 0.6), contrast(-0.15), brightness(0.05)) },
];

export function filterMatrix(id: FilterId): ColorMatrix {
  return FILTERS.find((f) => f.id === id)?.matrix ?? IDENTITY;
}

/** The single matrix for a filter followed by the user's adjustments. */
export function editMatrix(filter: FilterId, adjust: Adjustments): ColorMatrix {
  return chain(
    filterMatrix(filter),
    brightness(adjust.brightness),
    contrast(adjust.contrast),
    saturation(adjust.saturation),
    warmth(adjust.warmth),
  );
}

export function isIdentityMatrix(m: ColorMatrix): boolean {
  return m.every((v, i) => Math.abs(v - IDENTITY[i]) < 1e-6);
}

/** Applies a matrix to one RGBA color (0–1 values, clamped). Used by tests. */
export function applyToColor(m: ColorMatrix, [r, g, b, a]: [number, number, number, number]): number[] {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return [0, 1, 2, 3].map((row) =>
    clamp(m[row * 5] * r + m[row * 5 + 1] * g + m[row * 5 + 2] * b + m[row * 5 + 3] * a + m[row * 5 + 4]),
  );
}
