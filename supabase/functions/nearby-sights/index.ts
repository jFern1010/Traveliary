// Edge Function: "Must see" sights near the caller, from Wikidata, cached per ~11 km cell.
// The app sends its position; only the snapped cell center is used or stored (see sights.ts).
// The app ranks and filters to 50 km on the phone, with the exact position that never leaves it.
//
// Deploy: npx supabase@latest functions deploy nearby-sights --no-verify-jwt --use-api
// (JWT is checked here with auth.getUser, like delete-account.)

import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  buildQuery,
  cellFor,
  EXCLUDED_SIGHTS,
  parseResults,
  sanitizeLang,
  wikiSite,
  type Sight,
} from './sights.ts';

const USER_AGENT = 'Traveliary/0.9 (https://expo.dev/@jferns-team/traveliary; jonnelbfernandez@gmail.com)';
const WIKIDATA_TTL_DAYS = 30;
const FALLBACK_TTL_DAYS = 1;
const WIKIDATA_TIMEOUT_MS = 50_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fromWikidata(cell: ReturnType<typeof cellFor>, lang: string): Promise<Sight[]> {
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(buildQuery(cell, lang))}`;
  const res = await fetchWithTimeout(
    url,
    { headers: { Accept: 'application/sparql-results+json', 'User-Agent': USER_AGENT } },
    WIKIDATA_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`Wikidata ${res.status}`);
  return parseResults(await res.json(), lang);
}

/** Fallback when Wikidata is slow or down: nearest Wikipedia articles (10 km max, no fame score). */
async function fromWikipedia(cell: ReturnType<typeof cellFor>, lang: string): Promise<Sight[]> {
  const site = wikiSite(lang);
  const url =
    `https://${site}.wikipedia.org/w/api.php?action=query&list=geosearch&format=json` +
    `&gscoord=${cell.lat}|${cell.lng}&gsradius=10000&gslimit=50`;
  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': USER_AGENT } }, 10_000);
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  const body = (await res.json()) as {
    query?: { geosearch?: { pageid: number; title: string; lat: number; lon: number }[] };
  };
  return (body.query?.geosearch ?? []).map((p) => ({
    id: `wp:${site}:${p.pageid}`,
    name: p.title,
    description: null,
    lat: p.lat,
    lng: p.lon,
    fame: 1,
    imageUrl: null,
    wikiLang: site,
    wikiTitle: p.title,
  }));
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Not signed in' }, 401);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'Not signed in' }, 401);

  const body = (await req.json().catch(() => ({}))) as { lat?: unknown; lng?: unknown; lang?: unknown };
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return json({ error: 'Invalid position' }, 400);
  }
  const cell = cellFor(lat, lng);
  const lang = sanitizeLang(body.lang);

  // 1. Cache (per cell + language).
  const { data: cached } = await admin
    .from('sight_cache')
    .select('sights, source, fetched_at')
    .eq('cell', cell.key)
    .eq('lang', lang)
    .maybeSingle();
  const ttlDays = cached?.source === 'wikidata' ? WIKIDATA_TTL_DAYS : FALLBACK_TTL_DAYS;
  const fresh = cached && Date.now() - new Date(cached.fetched_at).getTime() < ttlDays * 86_400_000;

  let sights: Sight[];
  let source: 'wikidata' | 'wikipedia';
  if (fresh) {
    sights = cached.sights as Sight[];
    source = cached.source;
  } else {
    try {
      sights = await fromWikidata(cell, lang);
      source = 'wikidata';
    } catch (e) {
      console.error('Wikidata failed, falling back to Wikipedia', e);
      try {
        sights = await fromWikipedia(cell, lang);
        source = 'wikipedia';
      } catch (e2) {
        console.error('Wikipedia fallback failed', e2);
        // Serve a stale cache rather than nothing.
        if (cached) {
          sights = cached.sights as Sight[];
          source = cached.source;
        } else {
          return json({ error: 'Sights are unavailable right now. Please try again later.' }, 503);
        }
      }
    }
    if (sights.length > 0 && !(cached && sights === cached.sights)) {
      const { error } = await admin
        .from('sight_cache')
        .upsert({ cell: cell.key, lang, source, sights, fetched_at: new Date().toISOString() });
      if (error) console.error('cache write failed', error);
    }
  }

  // Exclusions also apply to results cached before an ID was added to the list.
  sights = sights.filter((s) => !EXCLUDED_SIGHTS.has(s.id));

  // 2. Live Traveliary activity per sight (photos within 300 m).
  const counts = new Map<string, number>();
  if (sights.length > 0) {
    const { data, error } = await admin.rpc('traveliary_counts_near', {
      p_points: sights.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng })),
      p_radius_m: 300,
    });
    if (error) console.error('traveliary_counts_near failed', error);
    for (const row of (data ?? []) as { id: string; photo_count: number }[]) counts.set(row.id, row.photo_count);
  }

  return json({
    cell: cell.key,
    source,
    sights: sights.map((s) => ({ ...s, travelerPhotos: counts.get(s.id) ?? 0 })),
  });
});
