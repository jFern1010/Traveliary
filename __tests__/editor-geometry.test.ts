import {
  cropRect,
  DEFAULT_CROP,
  displayLayout,
  fitFrame,
  frameAspect,
  isIdentityCrop,
  nextRotation,
  rotatedSize,
} from '@/features/editor/geometry';

const portrait = { width: 1200, height: 1600 };

describe('rotation', () => {
  it('cycles clockwise and swaps sides at 90/270', () => {
    expect(nextRotation(0)).toBe(90);
    expect(nextRotation(270)).toBe(0);
    expect(rotatedSize(portrait, 90)).toEqual({ width: 1600, height: 1200 });
    expect(rotatedSize(portrait, 180)).toEqual(portrait);
  });
});

describe('cropRect', () => {
  it('Original at scale 1 keeps the whole photo', () => {
    expect(cropRect(portrait, DEFAULT_CROP)).toEqual({ originX: 0, originY: 0, width: 1200, height: 1600 });
  });

  it('Square takes the largest centered square', () => {
    expect(cropRect(portrait, { ...DEFAULT_CROP, aspect: 'square' })).toEqual({
      originX: 0,
      originY: 200,
      width: 1200,
      height: 1200,
    });
  });

  it('16:9 on a portrait photo uses the full width', () => {
    const r = cropRect(portrait, { ...DEFAULT_CROP, aspect: '16:9' });
    expect(r.width).toBe(1200);
    expect(r.height).toBe(675);
    expect(r.originY).toBe(Math.round((1600 - 675) / 2));
  });

  it('panning moves the crop toward the opposite side, and stops at the edges', () => {
    const top = cropRect(portrait, { ...DEFAULT_CROP, aspect: 'square', panY: 1 });
    const bottom = cropRect(portrait, { ...DEFAULT_CROP, aspect: 'square', panY: -1 });
    expect(top.originY).toBe(0);
    expect(bottom.originY).toBe(400);
    expect(cropRect(portrait, { ...DEFAULT_CROP, aspect: 'square', panY: 5 }).originY).toBe(0);
  });

  it('zooming shrinks the crop around the center', () => {
    const r = cropRect(portrait, { ...DEFAULT_CROP, scale: 2 });
    expect(r).toEqual({ originX: 300, originY: 400, width: 600, height: 800 });
  });

  it('works in rotated coordinates', () => {
    const r = cropRect(portrait, { ...DEFAULT_CROP, rotation: 90 });
    expect(r).toEqual({ originX: 0, originY: 0, width: 1600, height: 1200 });
  });

  it('never leaves the image', () => {
    for (const aspect of ['original', 'square', '4:5', '16:9'] as const) {
      for (const pan of [-1, 0, 1]) {
        const r = cropRect(portrait, { ...DEFAULT_CROP, aspect, scale: 3, panX: pan, panY: -pan });
        expect(r.originX).toBeGreaterThanOrEqual(0);
        expect(r.originY).toBeGreaterThanOrEqual(0);
        expect(r.originX + r.width).toBeLessThanOrEqual(1200);
        expect(r.originY + r.height).toBeLessThanOrEqual(1600);
      }
    }
  });
});

describe('screen layout matches the export', () => {
  it('the frame shows the same share of the image as the crop rect', () => {
    const state = { ...DEFAULT_CROP, aspect: 'square' as const, scale: 1.5 };
    const frame = fitFrame(frameAspect('square', portrait), { width: 360, height: 500 });
    const layout = displayLayout(portrait, state, frame);
    const crop = cropRect(portrait, state);
    // Visible fraction of the image width on screen == cropped fraction of the image width.
    expect(frame.width / layout.width).toBeCloseTo(crop.width / 1200, 2);
  });
});

describe('isIdentityCrop', () => {
  it('detects untouched crops', () => {
    expect(isIdentityCrop(DEFAULT_CROP)).toBe(true);
    expect(isIdentityCrop({ ...DEFAULT_CROP, flipped: true })).toBe(false);
  });
});
