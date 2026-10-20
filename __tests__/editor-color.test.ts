import {
  applyToColor,
  brightness,
  compose,
  contrast,
  editMatrix,
  FILTERS,
  IDENTITY,
  isIdentityMatrix,
  NO_ADJUSTMENTS,
  saturation,
  warmth,
} from '@/features/editor/color';

const orange: [number, number, number, number] = [0.9, 0.5, 0.2, 1];

describe('matrices', () => {
  it('composing with identity changes nothing', () => {
    const m = saturation(0.5);
    expect(compose(IDENTITY, m)).toEqual(m);
    expect(compose(m, IDENTITY)).toEqual(m);
  });

  it('compose applies inner first, then outer', () => {
    // brighten then fully desaturate == gray of the brightened color
    const m = compose(saturation(-1), brightness(0.4));
    const [r, g, b] = applyToColor(m, orange);
    expect(r).toBeCloseTo(g);
    expect(g).toBeCloseTo(b);
    expect(r).toBeGreaterThan(applyToColor(saturation(-1), orange)[0]);
  });

  it('adjustments move colors the expected way', () => {
    expect(applyToColor(brightness(0.5), orange)[1]).toBeGreaterThan(orange[1]);
    expect(applyToColor(contrast(0.5), orange)[2]).toBeLessThan(orange[2]); // darks get darker
    const warm = applyToColor(warmth(1), orange);
    expect(warm[0]).toBeGreaterThan(orange[0] - 1e-9);
    expect(warm[2]).toBeLessThan(orange[2]);
  });

  it('never touches alpha', () => {
    for (const f of FILTERS) expect(applyToColor(f.matrix, orange)[3]).toBe(1);
  });
});

describe('filters', () => {
  it('has unique ids and an untouched Original', () => {
    expect(new Set(FILTERS.map((f) => f.id)).size).toBe(FILTERS.length);
    expect(isIdentityMatrix(FILTERS[0].matrix)).toBe(true);
  });

  it('Mono and Noir are grayscale', () => {
    for (const id of ['mono', 'noir']) {
      const [r, g, b] = applyToColor(FILTERS.find((f) => f.id === id)!.matrix, orange);
      expect(r).toBeCloseTo(g);
      expect(g).toBeCloseTo(b);
    }
  });
});

describe('editMatrix', () => {
  it('is identity for Original with no adjustments', () => {
    expect(isIdentityMatrix(editMatrix('original', NO_ADJUSTMENTS))).toBe(true);
  });

  it('combines a filter with adjustments', () => {
    expect(isIdentityMatrix(editMatrix('original', { ...NO_ADJUSTMENTS, warmth: 0.3 }))).toBe(false);
    expect(isIdentityMatrix(editMatrix('vivid', NO_ADJUSTMENTS))).toBe(false);
  });
});
