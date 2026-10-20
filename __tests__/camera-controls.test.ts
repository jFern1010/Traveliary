import { findUltraWideLens, nextFlash, nextZoom } from '@/features/capture/camera-controls';

describe('nextFlash', () => {
  it('cycles off → auto → on → off', () => {
    expect(nextFlash('off')).toBe('auto');
    expect(nextFlash('auto')).toBe('on');
    expect(nextFlash('on')).toBe('off');
  });
});

describe('nextZoom', () => {
  it('iOS: a 2× pinch from 1× adds log16(2) = 0.25', () => {
    expect(nextZoom(0, 2, 'ios')).toBeCloseTo(0.25);
    expect(nextZoom(0.25, 0.5, 'ios')).toBeCloseTo(0);
  });

  it('Android: a 2× pinch from 1× doubles the zoom ratio', () => {
    expect(nextZoom(0, 2, 'android')).toBeCloseTo(0.25);
    expect(nextZoom(0.25, 2, 'android')).toBeCloseTo(0.5);
  });

  it('Android: pinching back below 1× snaps to 0', () => {
    expect(nextZoom(0.25, 0.4, 'android')).toBe(0);
  });

  it('clamps to the 0–1 range on both platforms', () => {
    expect(nextZoom(0.9, 100, 'ios')).toBe(1);
    expect(nextZoom(0.9, 100, 'android')).toBe(1);
    expect(nextZoom(0, 0.1, 'ios')).toBe(0);
    expect(nextZoom(0, 0, 'android')).toBe(0);
  });
});

describe('findUltraWideLens', () => {
  it('finds the ultra-wide lens by its English name', () => {
    expect(findUltraWideLens(['Back Camera', 'Back Telephoto Camera', 'Back Ultra Wide Camera'])).toBe(
      'Back Ultra Wide Camera',
    );
  });

  it('returns null when the phone has none (or names it in another language)', () => {
    expect(findUltraWideLens(['Back Camera'])).toBeNull();
    expect(findUltraWideLens([])).toBeNull();
  });
});
