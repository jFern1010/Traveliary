-- Traveliary: "Must see" near you.
-- Sights come from Wikidata via the nearby-sights Edge Function and are cached here per ~11 km
-- cell and language. Traveliary photo counts per sight are computed live (not cached).

-- Spatial index for every "photos near a point" query (also item 2 of docs/scalability.md).
create index if not exists photos_location_idx on public.photos using gist (location);

create table public.sight_cache (
  cell       text not null,           -- "59.95,10.75": snapped cell center, never a user position
  lang       text not null,
  source     text not null check (source in ('wikidata', 'wikipedia')),
  sights     jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (cell, lang)
);

-- Only the Edge Function (service role) reads and writes the cache.
alter table public.sight_cache enable row level security;
revoke all on public.sight_cache from anon, authenticated;

-- Visible Traveliary photos within p_radius_m of each given point (service role, used for ranking).
-- p_points: [{"id": "Q1416", "lat": 59.9, "lng": 10.7}, ...]
create or replace function public.traveliary_counts_near(p_points jsonb, p_radius_m double precision default 300)
returns table (id text, photo_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select pt.id,
         (select count(*)::integer
          from public.photos ph
          where ph.status = 'visible'
            and extensions.st_dwithin(
                  ph.location,
                  extensions.st_setsrid(extensions.st_makepoint(pt.lng, pt.lat), 4326)::extensions.geography,
                  least(greatest(p_radius_m, 0), 2000)))
  from jsonb_to_recordset(p_points) as pt(id text, lat double precision, lng double precision)
  limit 500;
$$;

revoke all on function public.traveliary_counts_near(jsonb, double precision) from public, anon, authenticated;
grant execute on function public.traveliary_counts_near(jsonb, double precision) to service_role;

-- Travelers' photos at a sight, newest first, for the sight detail screen. Respects reports and
-- blocks through photos_public, and never returns positions.
create or replace function public.photos_near_point(
  p_lat      double precision,
  p_lng      double precision,
  p_radius_m double precision default 300,
  p_limit    integer default 30
)
returns setof public.photos_public
language sql
stable
security definer
set search_path = ''
as $$
  select pp.*
  from public.photos ph
  join public.photos_public pp on pp.id = ph.id
  where ph.status = 'visible'
    and extensions.st_dwithin(
          ph.location,
          extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
          least(greatest(p_radius_m, 0), 2000))
  order by ph.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

revoke all on function public.photos_near_point(double precision, double precision, double precision, integer) from public, anon;
grant execute on function public.photos_near_point(double precision, double precision, double precision, integer) to authenticated;
