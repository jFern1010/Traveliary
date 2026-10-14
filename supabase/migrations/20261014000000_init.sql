-- Traveliary M2: places, photos, storage bucket, and the RPCs the app calls.
--
-- Security model:
--   * Clients never read or write `photos` directly. Reads go through the `photos_public` view
--     (which omits the exact GPS location); writes go through security-definer RPCs.
--   * `places` is readable by any signed-in user (anonymous users count as signed in).
--   * Storage: each user can only write under `photos/<their uid>/...`; the bucket is public-read.

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.places (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(name) between 1 and 120),
  locality       text,
  region         text,
  country        text,
  country_code   char(2),
  lat            double precision not null check (lat between -90 and 90),
  lng            double precision not null check (lng between -180 and 180),
  centroid       extensions.geography(Point, 4326) not null,
  photo_count    integer not null default 0,
  last_photo_at  timestamptz,
  cover_photo_id uuid,
  created_at     timestamptz not null default now()
);

create index places_centroid_idx on public.places using gist (centroid);

create table public.photos (
  id            uuid primary key,  -- generated on the phone so retries are idempotent
  author_id     uuid not null references auth.users (id) on delete cascade,
  place_id      uuid not null references public.places (id),
  storage_path  text not null,
  thumb_path    text not null,
  width         integer not null check (width > 0),
  height        integer not null check (height > 0),
  location      extensions.geography(Point, 4326) not null,  -- exact, private
  accuracy_m    real,
  taken_at      timestamptz not null,
  created_at    timestamptz not null default now(),
  status        text not null default 'visible' check (status in ('visible', 'hidden')),
  report_count  integer not null default 0
);

create index photos_place_created_idx on public.photos (place_id, created_at desc);
create index photos_author_created_idx on public.photos (author_id, created_at desc);

alter table public.places
  add constraint places_cover_photo_fk
  foreign key (cover_photo_id) references public.photos (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Row level security & privileges
-- ---------------------------------------------------------------------------

alter table public.places enable row level security;
alter table public.photos enable row level security;

create policy "Signed-in users can read places"
  on public.places for select to authenticated using (true);

-- No policies on photos: with RLS on, direct table access returns nothing.
revoke all on public.photos from anon, authenticated;
revoke insert, update, delete on public.places from anon, authenticated;
revoke all on public.places from anon;

-- Public, location-free view of photos. Runs with the owner's rights (bypassing RLS on
-- `photos`), so its WHERE clause is the access rule: visible photos, plus your own hidden ones.
create view public.photos_public as
select
  ph.id,
  ph.place_id,
  pl.name as place_name,
  pl.country as place_country,
  ph.storage_path,
  ph.thumb_path,
  ph.width,
  ph.height,
  ph.taken_at,
  ph.created_at,
  ph.status,
  (ph.author_id = auth.uid()) as is_mine
from public.photos ph
join public.places pl on pl.id = ph.place_id
where ph.status = 'visible' or ph.author_id = auth.uid();

revoke all on public.photos_public from anon, authenticated;
grant select on public.photos_public to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: create_photo
-- Finds (or creates) the place for the photo and inserts it. Safe to call twice with the
-- same p_photo_id: the second call returns the existing result instead of duplicating.
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

  -- Serialize photo creation so two travelers posting at a brand-new spot at the same moment
  -- don't create two separate places. Fine at prototype scale.
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

  -- Place matching. Reverse geocoding names differ by phone language ("Genève" vs "Geneva"),
  -- so match primarily by distance: any place within 2 km, or a place with the same name within
  -- 25 km (big cities). Never across countries when both sides know the country.
  select * into v_place
  from public.places pl
  where (v_country_code is null or pl.country_code is null or pl.country_code = v_country_code)
    and (
      extensions.st_dwithin(pl.centroid, v_point, 2000)
      or (lower(pl.name) = lower(v_name) and extensions.st_dwithin(pl.centroid, v_point, 25000))
    )
  order by extensions.st_distance(pl.centroid, v_point)
  limit 1;

  if not found then
    insert into public.places (name, locality, region, country, country_code, lat, lng, centroid)
    values (
      left(v_name, 120),
      nullif(trim(p_locality), ''),
      nullif(trim(p_region), ''),
      nullif(trim(p_country), ''),
      v_country_code,
      p_lat,
      p_lng,
      v_point
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

  update public.places
  set photo_count = photo_count + 1,
      last_photo_at = now(),
      cover_photo_id = p_photo_id
  where id = v_place.id;

  return jsonb_build_object('photo_id', p_photo_id, 'place_id', v_place.id, 'place_name', v_place.name);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: delete_my_photo
-- Deletes the row and returns the storage paths; the app then removes the files through the
-- Storage API (Supabase does not allow deleting storage objects from SQL).
-- ---------------------------------------------------------------------------

create or replace function public.delete_my_photo(p_photo_id uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_deleted public.photos;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  delete from public.photos
  where id = p_photo_id and author_id = v_uid
  returning * into v_deleted;

  if not found then
    raise exception 'Photo not found' using errcode = 'P0002';
  end if;

  update public.places pl
  set photo_count = greatest(pl.photo_count - 1, 0),
      last_photo_at = (select max(created_at) from public.photos where place_id = pl.id),
      cover_photo_id = (
        select id from public.photos
        where place_id = pl.id and status = 'visible'
        order by created_at desc
        limit 1
      )
  where pl.id = v_deleted.place_id;

  -- Don't leave empty pins on the map.
  delete from public.places
  where id = v_deleted.place_id
    and not exists (select 1 from public.photos where place_id = v_deleted.place_id);

  return array[v_deleted.storage_path, v_deleted.thumb_path];
end;
$$;

revoke all on function public.create_photo(uuid, double precision, double precision, real, timestamptz, text, text, text, text, text, integer, integer) from public, anon;
grant execute on function public.create_photo(uuid, double precision, double precision, real, timestamptz, text, text, text, text, text, integer, integer) to authenticated;
revoke all on function public.delete_my_photo(uuid) from public, anon;
grant execute on function public.delete_my_photo(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: public-read bucket, users write only inside their own folder
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

create policy "Users can read their own photo files"
  on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can upload into their own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can overwrite their own photo files"
  on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own photo files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
