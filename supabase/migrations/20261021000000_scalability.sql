-- Traveliary scalability fixes before the beta (see docs/scalability.md).
--   1. create_photo locks per ~2 km area instead of one global lock.
--   2. Map/list queries use stored per-place counts unless the viewer has blocked someone.
--   3. Indexes for place bounds and per-place photo queries.

create index if not exists places_lat_lng_idx on public.places (lat, lng) where photo_count > 0;
create index if not exists photos_place_status_created_idx on public.photos (place_id, status, created_at desc);
create index if not exists blocks_blocker_idx on public.blocks (blocker_id);

-- ---------------------------------------------------------------------------
-- 2. places_in_bounds / places_near: fast path from stored aggregates. Most viewers block nobody;
--    only viewers with blocks pay for a per-photo recount.
-- ---------------------------------------------------------------------------

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
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_limit integer := least(greatest(p_limit, 1), 500);
begin
  if not exists (select 1 from public.blocks b where b.blocker_id = auth.uid()) then
    return query
    select pl.id, pl.name, pl.country, pl.lat, pl.lng, pl.photo_count, pl.last_photo_at, cover.thumb_path
    from public.places pl
    left join public.photos cover on cover.id = pl.cover_photo_id
    where pl.photo_count > 0
      and pl.lat between p_min_lat and p_max_lat
      and (
        (p_min_lng <= p_max_lng and pl.lng between p_min_lng and p_max_lng)
        or (p_min_lng > p_max_lng and (pl.lng >= p_min_lng or pl.lng <= p_max_lng))
      )
    order by pl.photo_count desc, pl.last_photo_at desc
    limit v_limit;
  else
    return query
    select pl.id, pl.name, pl.country, pl.lat, pl.lng,
           seen.photo_count, seen.last_photo_at, seen.cover_thumb_path
    from public.places pl
    cross join lateral (
      select count(*)::integer as photo_count,
             max(ph.created_at) as last_photo_at,
             (array_agg(ph.thumb_path order by ph.created_at desc))[1] as cover_thumb_path
      from public.photos ph
      where ph.place_id = pl.id
        and ph.status = 'visible'
        and not exists (
          select 1 from public.blocks b
          where b.blocker_id = auth.uid() and b.blocked_id = ph.author_id
        )
    ) seen
    where pl.photo_count > 0
      and seen.photo_count > 0
      and pl.lat between p_min_lat and p_max_lat
      and (
        (p_min_lng <= p_max_lng and pl.lng between p_min_lng and p_max_lng)
        or (p_min_lng > p_max_lng and (pl.lng >= p_min_lng or pl.lng <= p_max_lng))
      )
    order by seen.photo_count desc, seen.last_photo_at desc
    limit v_limit;
  end if;
end;
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
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_here   extensions.geography :=
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  v_radius double precision := least(greatest(p_radius_m, 0), 500000);
  v_limit  integer := least(greatest(p_limit, 1), 200);
begin
  if not exists (select 1 from public.blocks b where b.blocker_id = auth.uid()) then
    return query
    select pl.id, pl.name, pl.country, pl.lat, pl.lng, pl.photo_count, pl.last_photo_at, cover.thumb_path,
           extensions.st_distance(pl.centroid, v_here)
    from public.places pl
    left join public.photos cover on cover.id = pl.cover_photo_id
    where pl.photo_count > 0
      and extensions.st_dwithin(pl.centroid, v_here, v_radius)
    order by extensions.st_distance(pl.centroid, v_here)
    limit v_limit;
  else
    return query
    select pl.id, pl.name, pl.country, pl.lat, pl.lng,
           seen.photo_count, seen.last_photo_at, seen.cover_thumb_path,
           extensions.st_distance(pl.centroid, v_here)
    from public.places pl
    cross join lateral (
      select count(*)::integer as photo_count,
             max(ph.created_at) as last_photo_at,
             (array_agg(ph.thumb_path order by ph.created_at desc))[1] as cover_thumb_path
      from public.photos ph
      where ph.place_id = pl.id
        and ph.status = 'visible'
        and not exists (
          select 1 from public.blocks b
          where b.blocker_id = auth.uid() and b.blocked_id = ph.author_id
        )
    ) seen
    where pl.photo_count > 0
      and seen.photo_count > 0
      and extensions.st_dwithin(pl.centroid, v_here, v_radius)
    order by extensions.st_distance(pl.centroid, v_here)
    limit v_limit;
  end if;
end;
$$;

revoke all on function public.places_in_bounds(double precision, double precision, double precision, double precision, integer) from public, anon;
grant execute on function public.places_in_bounds(double precision, double precision, double precision, double precision, integer) to authenticated;
revoke all on function public.places_near(double precision, double precision, double precision, integer) from public, anon;
grant execute on function public.places_near(double precision, double precision, double precision, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 1. create_photo: lock only the ~2 km area being posted to. Two posts at the same new spot still
--    can't create duplicate places; posts in different areas never wait for each other.
-- ---------------------------------------------------------------------------

create or replace function public.create_photo(
  p_photo_id      uuid,
  p_lat           double precision,
  p_lng           double precision,
  p_accuracy_m    real,
  p_taken_at      timestamptz,
  p_place_name    text,
  p_locality      text,
  p_region        text,
  p_country       text,
  p_country_code  text,
  p_width         integer,
  p_height        integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid          uuid := auth.uid();
  v_point        extensions.geography;
  v_country_code char(2) := upper(nullif(trim(p_country_code), ''));
  v_name         text := nullif(trim(p_place_name), '');
  v_storage_path text;
  v_thumb_path   text;
  v_existing     public.photos;
  v_place        public.places;
  v_lat          double precision;
  v_lng          double precision;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid coordinates' using errcode = '22023';
  end if;
  if v_name is null then
    raise exception 'Place name is required' using errcode = '22023';
  end if;
  if p_taken_at > now() + interval '1 day' then
    raise exception 'taken_at is in the future' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(
    'traveliary.place:' || floor(p_lat / 0.02)::text || ':' || floor(p_lng / 0.02)::text
  ));

  v_storage_path := v_uid::text || '/' || p_photo_id::text || '.jpg';
  v_thumb_path   := v_uid::text || '/' || p_photo_id::text || '_thumb.jpg';
  v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;

  -- Idempotency: a retry of an upload that already succeeded.
  select * into v_existing from public.photos where id = p_photo_id;
  if found then
    if v_existing.author_id <> v_uid then
      raise exception 'Photo id already used' using errcode = '23505';
    end if;
    select * into v_place from public.places where id = v_existing.place_id;
    return jsonb_build_object('photo_id', v_existing.id, 'place_id', v_place.id, 'place_name', v_place.name);
  end if;

  -- Place matching: prefer a place with the same name within 1 km (the same neighborhood);
  -- otherwise any place within 300 m (same spot, named differently by another phone's language).
  -- Never across countries when both sides know the country.
  select * into v_place
  from public.places pl
  where (v_country_code is null or pl.country_code is null or pl.country_code = v_country_code)
    and (
      (lower(pl.name) = lower(v_name) and extensions.st_dwithin(pl.centroid, v_point, 1000))
      or extensions.st_dwithin(pl.centroid, v_point, 300)
    )
  order by (lower(pl.name) = lower(v_name)) desc, extensions.st_distance(pl.centroid, v_point)
  limit 1;

  if not found then
    -- New places start at the snapped position, never the exact one.
    v_lat := public.snap_coord(p_lat);
    v_lng := public.snap_coord(p_lng);
    insert into public.places (name, locality, region, country, country_code, lat, lng, centroid)
    values (
      left(v_name, 120),
      nullif(trim(p_locality), ''),
      nullif(trim(p_region), ''),
      nullif(trim(p_country), ''),
      v_country_code,
      v_lat,
      v_lng,
      extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography
    )
    returning * into v_place;
  end if;

  insert into public.photos (
    id, author_id, place_id, storage_path, thumb_path, width, height, location, accuracy_m, taken_at
  )
  values (
    p_photo_id, v_uid, v_place.id, v_storage_path, v_thumb_path, p_width, p_height, v_point,
    p_accuracy_m, coalesce(p_taken_at, now())
  );

  -- Counts, cover photo and the (snapped, averaged) pin position.
  perform public.refresh_place_stats(v_place.id);

  return jsonb_build_object('photo_id', p_photo_id, 'place_id', v_place.id, 'place_name', v_place.name);
end;
$$;

revoke all on function public.create_photo(uuid, double precision, double precision, real, timestamptz, text, text, text, text, text, integer, integer) from public, anon;
grant execute on function public.create_photo(uuid, double precision, double precision, real, timestamptz, text, text, text, text, text, integer, integer) to authenticated;
