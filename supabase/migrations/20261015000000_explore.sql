-- Traveliary M3: map and nearby queries for the Explore tab.
-- Both return place centroids only (never exact photo locations) plus the newest visible thumbnail.

create or replace function public.places_in_bounds(
  p_min_lat double precision,
  p_min_lng double precision,
  p_max_lat double precision,
  p_max_lng double precision,
  p_limit   integer default 200
)
returns table (
  id            uuid,
  name          text,
  country       text,
  lat           double precision,
  lng           double precision,
  photo_count   integer,
  last_photo_at timestamptz,
  cover_thumb_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select pl.id, pl.name, pl.country, pl.lat, pl.lng, pl.photo_count, pl.last_photo_at, cover.thumb_path
  from public.places pl
  left join lateral (
    select ph.thumb_path
    from public.photos ph
    where ph.place_id = pl.id and ph.status = 'visible'
    order by ph.created_at desc
    limit 1
  ) cover on true
  where pl.photo_count > 0
    and pl.lat between p_min_lat and p_max_lat
    -- A view across the antimeridian (e.g. over Fiji) has min_lng > max_lng.
    and (
      (p_min_lng <= p_max_lng and pl.lng between p_min_lng and p_max_lng)
      or (p_min_lng > p_max_lng and (pl.lng >= p_min_lng or pl.lng <= p_max_lng))
    )
  order by pl.photo_count desc, pl.last_photo_at desc
  limit least(greatest(p_limit, 1), 500);
$$;

create or replace function public.places_near(
  p_lat      double precision,
  p_lng      double precision,
  p_radius_m double precision default 50000,
  p_limit    integer default 50
)
returns table (
  id            uuid,
  name          text,
  country       text,
  lat           double precision,
  lng           double precision,
  photo_count   integer,
  last_photo_at timestamptz,
  cover_thumb_path text,
  distance_m    double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  with here as (
    select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as point
  )
  select pl.id, pl.name, pl.country, pl.lat, pl.lng, pl.photo_count, pl.last_photo_at, cover.thumb_path,
         extensions.st_distance(pl.centroid, here.point) as distance_m
  from public.places pl
  cross join here
  left join lateral (
    select ph.thumb_path
    from public.photos ph
    where ph.place_id = pl.id and ph.status = 'visible'
    order by ph.created_at desc
    limit 1
  ) cover on true
  where pl.photo_count > 0
    and extensions.st_dwithin(pl.centroid, here.point, least(greatest(p_radius_m, 0), 500000))
  order by distance_m
  limit least(greatest(p_limit, 1), 200);
$$;

revoke all on function public.places_in_bounds(double precision, double precision, double precision, double precision, integer) from public, anon;
grant execute on function public.places_in_bounds(double precision, double precision, double precision, double precision, integer) to authenticated;
revoke all on function public.places_near(double precision, double precision, double precision, integer) from public, anon;
grant execute on function public.places_near(double precision, double precision, double precision, integer) to authenticated;
