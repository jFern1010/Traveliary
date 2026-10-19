import { commonsFilePage, directionsUrl, formatKm } from '@/features/sights/links';

describe('directionsUrl', () => {
  it('uses Apple Maps on iOS and Google Maps elsewhere', () => {
    expect(directionsUrl('ios', 59.9075, 10.7531)).toBe('https://maps.apple.com/?daddr=59.9075,10.7531');
    expect(directionsUrl('android', 59.9075, 10.7531)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=59.9075,10.7531',
    );
  });
});

describe('commonsFilePage', () => {
  it('links a Commons thumbnail to its file page (author + license)', () => {
    expect(
      commonsFilePage('https://commons.wikimedia.org/wiki/Special:FilePath/Oslo%20Opera.jpg?width=640'),
    ).toBe('https://commons.wikimedia.org/wiki/File:Oslo%20Opera.jpg');
    expect(commonsFilePage(null)).toBeNull();
  });
});

describe('formatKm', () => {
  it('formats short and long distances', () => {
    expect(formatKm(0.004)).toBe('10 m');
    expect(formatKm(0.347)).toBe('350 m');
    expect(formatKm(4.23)).toBe('4.2 km');
    expect(formatKm(38.4)).toBe('38 km');
  });
});
