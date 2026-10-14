import { formatDistance, formatPhotoCount, regionToBounds } from '@/features/places/geo';

describe('regionToBounds', () => {
  const zermatt = { latitude: 46.02, longitude: 7.7449, latitudeDelta: 0.1, longitudeDelta: 0.1 };

  it('pads the visible region so it contains it with margin', () => {
    const b = regionToBounds(zermatt);
    expect(b.minLat).toBeLessThan(46.02 - 0.05);
    expect(b.maxLat).toBeGreaterThan(46.02 + 0.05);
    expect(b.minLng).toBeLessThan(7.7449 - 0.05);
    expect(b.maxLng).toBeGreaterThan(7.7449 + 0.05);
  });

  it('returns the same bounds for a tiny pan (cache-friendly)', () => {
    expect(regionToBounds({ ...zermatt, latitude: 46.0201, longitude: 7.7451 })).toEqual(
      regionToBounds(zermatt),
    );
  });

  it('clamps latitude at the poles', () => {
    const b = regionToBounds({ latitude: 89, longitude: 0, latitudeDelta: 10, longitudeDelta: 10 });
    expect(b.maxLat).toBe(90);
  });

  it('wraps across the antimeridian (min > max)', () => {
    const b = regionToBounds({ latitude: -17, longitude: 179.5, latitudeDelta: 2, longitudeDelta: 2 });
    expect(b.minLng).toBeGreaterThan(b.maxLng);
    expect(b.minLng).toBeGreaterThan(170);
    expect(b.maxLng).toBeLessThan(-170);
  });

  it('covers the whole world when zoomed far out', () => {
    const b = regionToBounds({ latitude: 0, longitude: 0, latitudeDelta: 150, longitudeDelta: 200 });
    expect(b).toMatchObject({ minLng: -180, maxLng: 180 });
  });
});

describe('formatDistance', () => {
  it('formats meters and kilometers', () => {
    expect(formatDistance(4)).toBe('10 m');
    expect(formatDistance(347)).toBe('350 m');
    expect(formatDistance(4230)).toBe('4.2 km');
    expect(formatDistance(38_400)).toBe('38 km');
  });
});

describe('formatPhotoCount', () => {
  it('pluralizes', () => {
    expect(formatPhotoCount(1)).toBe('1 photo');
    expect(formatPhotoCount(12)).toBe('12 photos');
  });
});
