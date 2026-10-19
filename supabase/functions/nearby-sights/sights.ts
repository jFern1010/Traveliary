// Pure helpers for the nearby-sights Edge Function (no Deno or npm imports, so Jest can test them).

export type Sight = {
  /** Wikidata ID, e.g. "Q213520". */
  id: string;
  name: string;
  description: string | null;
  lat: number;
  lng: number;
  /** Number of Wikipedia language editions with an article: our "how famous" score. */
  fame: number;
  imageUrl: string | null;
  /** Wikipedia article in the requested language, else English. */
  wikiLang: string | null;
  wikiTitle: string | null;
};

/** Grid size for caching. 0.1° ≈ 11 km, so everyone in the same area shares one cached result. */
export const CELL_DEG = 0.1;
/** User radius (50 km) + the farthest a user can be from their cell's center. */
export const QUERY_RADIUS_KM = 58;
export const MAX_SIGHTS = 150;

export type Cell = { key: string; lat: number; lng: number };

/** Snaps a position to its cache cell. Only this coarse center is ever sent to Wikidata. */
export function cellFor(lat: number, lng: number): Cell {
  const cLat = Math.floor(lat / CELL_DEG) * CELL_DEG + CELL_DEG / 2;
  const cLng = Math.floor(lng / CELL_DEG) * CELL_DEG + CELL_DEG / 2;
  const round = (v: number) => Number(v.toFixed(2));
  return { key: `${round(cLat)},${round(cLng)}`, lat: round(cLat), lng: round(cLng) };
}

/** Wikipedia language code from the phone (e.g. "nb-NO" → "nb"); anything odd falls back to English. */
export function sanitizeLang(lang: unknown): string {
  const code = typeof lang === 'string' ? lang.toLowerCase().split(/[-_]/)[0] : '';
  return /^[a-z]{2,3}$/.test(code) ? code : 'en';
}

/** Wikipedia site code for a language: Norwegian Bokmål is "no.wikipedia.org", not "nb". */
export function wikiSite(lang: string): string {
  return lang === 'nb' ? 'no' : lang;
}

/**
 * Places never suggested as "must see", e.g. memorial sites known mainly for a tragedy.
 * Add Wikidata IDs here when testers or moderation flag a suggestion as inappropriate.
 */
export const EXCLUDED_SIGHTS = new Set<string>([
  'Q106357', // Utøya: site of the 22 July 2011 attacks
]);

// What counts as a sight. Instance-of (P31) types kept, and types dropped even if heritage-listed.
// Direct P31 checks only: subclass (P279*) traversal made the query take ~50 s.
const KEEP_TYPES = [
  'Q570116', // tourist attraction
  'Q33506', // museum
  'Q207694', // art museum
  'Q23413', // castle
  'Q57821', // fortification
  'Q16970', // church building
  'Q2977', // cathedral
  'Q4989906', // monument
  'Q179700', // statue
  'Q839954', // archaeological site
  'Q22698', // park
  'Q1107656', // garden
  'Q16560', // palace
  'Q6017969', // scenic viewpoint
  'Q43501', // zoo
  'Q34038', // waterfall
  'Q24398318', // religious building
  'Q1370598', // structure of worship
  'Q153562', // opera house
  'Q8502', // mountain
  'Q35666', // glacier
  'Q23397', // lake
  'Q46169', // national park
  'Q35509', // cave
  'Q23442', // island
  'Q40080', // beach
  'Q133056', // mountain pass
];
const DROP_TYPES = [
  'Q55488', // railway station
  'Q55491', // underground railway station
  'Q1339195', // station building
  'Q18543139', // central station
  'Q728937', // railway line
  'Q16917', // hospital
  'Q27686', // hotel
  'Q2385804', // educational institution
  'Q3918', // university
  'Q9826', // high school
  'Q1664720', // institute
  'Q43229', // organization
  'Q1248784', // airport
  'Q4830453', // business
  'Q15911314', // association
  'Q7075', // library
  'Q4671277', // academic institution
  'Q3914', // school
];

export function buildQuery(cell: Cell, lang: string, radiusKm = QUERY_RADIUS_KM, limit = MAX_SIGHTS): string {
  const values = (ids: string[]) => ids.map((id) => `wd:${id}`).join(' ');
  return `
SELECT ?item ?itemLabel ?itemDescription ?sitelinks
       (SAMPLE(?coord) AS ?c) (SAMPLE(?image) AS ?img)
       (SAMPLE(?localTitle) AS ?lt) (SAMPLE(?enTitle) AS ?et) WHERE {
  SERVICE wikibase:around {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(${cell.lng} ${cell.lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${radiusKm}" .
  }
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= 3)
  { ?item wdt:P1435 [] . }
  UNION { VALUES ?type { ${values(KEEP_TYPES)} } ?item wdt:P31 ?type . }
  FILTER NOT EXISTS { VALUES ?ex { ${values(DROP_TYPES)} } ?item wdt:P31 ?ex . }
  FILTER NOT EXISTS { ?item wdt:P1082 [] . }
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL { ?la schema:about ?item ; schema:isPartOf <https://${wikiSite(lang)}.wikipedia.org/> ; schema:name ?localTitle . }
  OPTIONAL { ?le schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enTitle . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${lang},en". }
}
GROUP BY ?item ?itemLabel ?itemDescription ?sitelinks
ORDER BY DESC(?sitelinks)
LIMIT ${limit}`;
}

type Binding = Record<string, { value: string } | undefined>;

/** "Point(10.7 59.9)" → [lng, lat] */
function parsePoint(wkt: string | undefined): [number, number] | null {
  const m = wkt?.match(/Point\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** Commons "Special:FilePath" URL, resized server-side to a list/detail friendly width. */
export function commonsThumb(url: string | undefined, width = 640): string | null {
  if (!url) return null;
  return `${url.replace(/^http:/, 'https:')}?width=${width}`;
}

export function parseResults(json: unknown, lang: string): Sight[] {
  const bindings = (json as { results?: { bindings?: Binding[] } })?.results?.bindings ?? [];
  const sights: Sight[] = [];
  for (const b of bindings) {
    const id = b.item?.value.split('/').pop();
    const point = parsePoint(b.c?.value);
    const name = b.itemLabel?.value;
    // Unlabelled items come back as their QID: useless to show.
    if (!id || !point || !name || /^Q\d+$/.test(name) || EXCLUDED_SIGHTS.has(id)) continue;
    const localTitle = b.lt?.value ?? null;
    const enTitle = b.et?.value ?? null;
    sights.push({
      id,
      name,
      description: b.itemDescription?.value ?? null,
      lat: point[1],
      lng: point[0],
      fame: Number(b.sitelinks?.value ?? 0),
      imageUrl: commonsThumb(b.img?.value),
      wikiLang: localTitle ? wikiSite(lang) : enTitle ? 'en' : null,
      wikiTitle: localTitle ?? enTitle,
    });
  }
  return sights;
}
