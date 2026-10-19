import {
  buildQuery,
  cellFor,
  commonsThumb,
  parseResults,
  sanitizeLang,
  wikiSite,
} from '../supabase/functions/nearby-sights/sights';

describe('cellFor', () => {
  it('snaps nearby positions to the same cache cell center', () => {
    const a = cellFor(59.9139, 10.7522);
    const b = cellFor(59.9401, 10.7199);
    expect(a).toEqual(b);
    expect(a).toEqual({ key: '59.95,10.75', lat: 59.95, lng: 10.75 });
  });

  it('is stable: a cell center maps to the same cell (the app sends centers, the server re-snaps)', () => {
    for (const [lat, lng] of [[59.9139, 10.7522], [-33.8688, 151.2093], [35.6812, 139.7671], [10.3157, 123.8854]]) {
      const cell = cellFor(lat, lng);
      expect(cellFor(cell.lat, cell.lng)).toEqual(cell);
    }
  });

  it('handles negative coordinates', () => {
    expect(cellFor(-33.8688, 151.2093).key).toBe('-33.85,151.25');
  });
});

describe('sanitizeLang / wikiSite', () => {
  it('reduces locales to a safe language code', () => {
    expect(sanitizeLang('nb-NO')).toBe('nb');
    expect(sanitizeLang('en_US')).toBe('en');
    expect(sanitizeLang('x"; DROP')).toBe('en');
    expect(sanitizeLang(undefined)).toBe('en');
  });

  it('maps Bokmål to the "no" Wikipedia', () => {
    expect(wikiSite('nb')).toBe('no');
    expect(wikiSite('de')).toBe('de');
  });
});

describe('buildQuery', () => {
  it('queries around the cell center (never the exact position) in the given language', () => {
    const q = buildQuery(cellFor(59.9139, 10.7522), 'nb');
    expect(q).toContain('Point(10.75 59.95)');
    expect(q).toContain('https://no.wikipedia.org/');
    expect(q).toContain('wikibase:language "nb,en"');
    expect(q).not.toContain('59.9139');
  });
});

describe('parseResults', () => {
  const json = {
    results: {
      bindings: [
        {
          item: { value: 'http://www.wikidata.org/entity/Q1416' },
          itemLabel: { value: 'Operahuset i Oslo' },
          itemDescription: { value: 'operahus i Oslo' },
          sitelinks: { value: '44' },
          c: { value: 'Point(10.7525 59.9075)' },
          img: { value: 'http://commons.wikimedia.org/wiki/Special:FilePath/Opera.jpg' },
          lt: { value: 'Operahuset i Oslo' },
        },
        {
          item: { value: 'http://www.wikidata.org/entity/Q999' },
          itemLabel: { value: 'Q999' },
          sitelinks: { value: '5' },
          c: { value: 'Point(10 60)' },
        },
      ],
    },
  };

  it('maps bindings to sights and drops unlabelled items', () => {
    const sights = parseResults(json, 'nb');
    expect(sights).toHaveLength(1);
    expect(sights[0]).toEqual({
      id: 'Q1416',
      name: 'Operahuset i Oslo',
      description: 'operahus i Oslo',
      lat: 59.9075,
      lng: 10.7525,
      fame: 44,
      imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Opera.jpg?width=640',
      wikiLang: 'no',
      wikiTitle: 'Operahuset i Oslo',
    });
  });

  it('drops excluded places such as memorial sites', () => {
    const utoya = {
      item: { value: 'http://www.wikidata.org/entity/Q106357' },
      itemLabel: { value: 'Utøya' },
      sitelinks: { value: '59' },
      c: { value: 'Point(10.23 60.02)' },
    };
    expect(parseResults({ results: { bindings: [utoya] } }, 'en')).toEqual([]);
  });

  it('survives malformed responses', () => {
    expect(parseResults(null, 'en')).toEqual([]);
    expect(parseResults({ error: 'timeout' }, 'en')).toEqual([]);
  });
});

describe('commonsThumb', () => {
  it('forces https and a width', () => {
    expect(commonsThumb('http://commons.wikimedia.org/wiki/Special:FilePath/A.jpg', 320)).toBe(
      'https://commons.wikimedia.org/wiki/Special:FilePath/A.jpg?width=320',
    );
    expect(commonsThumb(undefined)).toBeNull();
  });
});
