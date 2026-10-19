import { distanceKm, rankSights, wikipediaUrl, type Sight } from '@/features/sights/rank';

const base: Omit<Sight, 'id' | 'name' | 'lat' | 'lng' | 'fame'> = {
  description: null,
  imageUrl: null,
  wikiLang: 'en',
  wikiTitle: null,
  travelerPhotos: 0,
};
const oslo = { latitude: 59.9139, longitude: 10.7522 };

describe('distanceKm', () => {
  it('measures real distances', () => {
    // Oslo → Bergen is about 305 km in a straight line.
    expect(distanceKm(59.9139, 10.7522, 60.3913, 5.3221)).toBeGreaterThan(300);
    expect(distanceKm(59.9139, 10.7522, 60.3913, 5.3221)).toBeLessThan(310);
    expect(distanceKm(1, 1, 1, 1)).toBe(0);
  });
});

describe('rankSights', () => {
  const opera = { ...base, id: 'opera', name: 'Opera House', lat: 59.9075, lng: 10.7531, fame: 44 };
  const chapel = { ...base, id: 'chapel', name: 'Local chapel', lat: 59.915, lng: 10.75, fame: 3 };
  const farFamous = { ...base, id: 'far', name: 'Famous but 45 km', lat: 60.32, lng: 10.75, fame: 60 };
  const outside = { ...base, id: 'out', name: 'Beyond 50 km', lat: 60.5, lng: 10.75, fame: 200 };

  it('drops sights beyond 50 km', () => {
    const ids = rankSights([opera, outside], oslo).map((s) => s.id);
    expect(ids).toEqual(['opera']);
  });

  it('prefers famous nearby places over obscure nearby ones', () => {
    expect(rankSights([chapel, opera], oslo)[0].id).toBe('opera');
  });

  it('lets a very close, famous place beat a slightly more famous distant one', () => {
    expect(rankSights([farFamous, opera], oslo)[0].id).toBe('opera');
  });

  it('boosts places where travelers post', () => {
    const busyChapel = { ...chapel, travelerPhotos: 40 };
    const quietTwin = { ...chapel, id: 'twin', travelerPhotos: 0 };
    expect(rankSights([quietTwin, busyChapel], oslo)[0].id).toBe('chapel');
  });

  it('caps the number of results', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ ...chapel, id: `c${i}` }));
    expect(rankSights(many, oslo)).toHaveLength(30);
  });
});

describe('wikipediaUrl', () => {
  it('builds a mobile article link', () => {
    expect(wikipediaUrl({ wikiLang: 'no', wikiTitle: 'Operahuset i Oslo' })).toBe(
      'https://no.m.wikipedia.org/wiki/Operahuset_i_Oslo',
    );
    expect(wikipediaUrl({ wikiLang: null, wikiTitle: null })).toBeNull();
  });
});
