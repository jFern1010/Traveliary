import {
  formatCoordinates,
  formatPlaceLabel,
  suggestPlace,
  type GeocodedAddress,
} from '@/features/capture/place-name';

const empty: GeocodedAddress = {
  name: null,
  city: null,
  district: null,
  subregion: null,
  region: null,
  country: null,
  isoCountryCode: null,
};

describe('suggestPlace', () => {
  it('uses the city as the place name', () => {
    const place = suggestPlace({
      ...empty,
      name: 'Bahnhofstrasse 1',
      city: 'Zermatt',
      region: 'Valais',
      country: 'Switzerland',
      isoCountryCode: 'ch',
    });
    expect(place).toEqual({
      name: 'Zermatt',
      locality: 'Zermatt',
      region: 'Valais',
      country: 'Switzerland',
      countryCode: 'CH',
    });
  });

  it('falls back to district, then subregion, when there is no city', () => {
    expect(suggestPlace({ ...empty, district: 'Shibuya', country: 'Japan' })?.name).toBe('Shibuya');
    expect(suggestPlace({ ...empty, subregion: 'Visp', country: 'Switzerland' })?.name).toBe(
      'Visp',
    );
  });

  it('falls back to the region for remote spots', () => {
    const place = suggestPlace({ ...empty, region: 'Svalbard', country: 'Norway' });
    expect(place?.name).toBe('Svalbard');
    expect(place?.locality).toBeNull();
  });

  it('ignores blank strings', () => {
    expect(suggestPlace({ ...empty, city: '  ', region: 'Valais' })?.name).toBe('Valais');
  });

  it('returns null when nothing usable was found', () => {
    expect(suggestPlace(empty)).toBeNull();
    expect(suggestPlace(null)).toBeNull();
  });
});

describe('formatPlaceLabel', () => {
  it('joins place and country', () => {
    expect(
      formatPlaceLabel({
        name: 'Zermatt',
        locality: 'Zermatt',
        region: 'Valais',
        country: 'Switzerland',
        countryCode: 'CH',
      }),
    ).toBe('Zermatt, Switzerland');
  });

  it('does not repeat the country', () => {
    expect(
      formatPlaceLabel({
        name: 'Singapore',
        locality: null,
        region: null,
        country: 'Singapore',
        countryCode: 'SG',
      }),
    ).toBe('Singapore');
  });
});

describe('formatCoordinates', () => {
  it('formats hemispheres', () => {
    expect(formatCoordinates(46.02069, 7.74912)).toBe('46.0207° N, 7.7491° E');
    expect(formatCoordinates(-33.8568, -151.2153)).toBe('33.8568° S, 151.2153° W');
  });
});
