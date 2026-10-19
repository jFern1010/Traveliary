-- Traveliary: neighborhood-level places and privacy-safe pin positions.
--
-- Before: places were matched by town name within 25 km, so all of Oslo became one place, and a
-- place's pin stayed at the first photo's exact position (which also revealed that position).
-- Now:
--   * the app names places by district when the phone knows one ("Grünerløkka" in Oslo);
--   * matching: same name within 5 km, otherwise any place within 300 m, otherwise a new place;
--   * a place's pin is the average position of its visible photos, snapped to a ~250 m grid,
--     so it sits near where photos are taken without revealing anyone's exact position.

-- ~0.0025° ≈ 280 m of latitude (less in longitude toward the poles).
create or replace function public.snap_coord(v double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select round(v / 0.0025) * 0.0025;
$$;

-- Same name and signature as before; now also recomputes the pin position.
create or replace function public.refresh_place_stats(p_place_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  with visible as (
    select ph.id, ph.created_at, ph.location::extensions.geometry as g
    from public.photos ph
    where ph.place_id = p_place_id and ph.status = 'visible'
  ),
  agg as (
    select
      count(*)                                            as photo_count,
      max(created_at)                                     as last_photo_at,
      public.snap_coord(avg(extensions.st_y(g)))          as lat,
      public.snap_coord(avg(extensions.st_x(g)))          as lng,
      (array_agg(id order by created_at desc))[1]         as cover_photo_id
    from visible
  )
  update public.places pl
  set photo_count    = agg.photo_count,
      last_photo_at  = agg.last_photo_at,
      cover_photo_id = agg.cover_photo_id,
      -- Keep the old position when nothing is visible (the place is hidden from the map anyway).
      lat      = coalesce(agg.lat, pl.lat),
      lng      = coalesce(agg.lng, pl.lng),
      centroid = case
                   when agg.lat is null then pl.centroid
                   else extensions.st_setsrid(extensions.st_makepoint(agg.lng, agg.lat), 4326)::extensions.geography
                 end
  from agg
  where pl.id = p_place_id;
$$;

revoke all on function public.refresh_place_stats(uuid) from public, anon, authenticated;
revoke all on function public.snap_coord(double precision) from public, anon, authenticated;

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

  perform pg_advisory_xact_lock(hashtext('traveliary.create_photo'));

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

  -- Place matching: prefer a place with the same name within 5 km (the same district or town);
  -- otherwise any place within 300 m (same spot, named differently by another phone's language).
  -- Never across countries when both sides know the country.
  select * into v_place
  from public.places pl
  where (v_country_code is null or pl.country_code is null or pl.country_code = v_country_code)
    and (
      (lower(pl.name) = lower(v_name) and extensions.st_dwithin(pl.centroid, v_point, 5000))
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

-- Existing places: move pins to the snapped average of their photos (this also stops pins of
-- single-photo places from revealing that photo's exact position).
select public.refresh_place_stats(id) from public.places;
