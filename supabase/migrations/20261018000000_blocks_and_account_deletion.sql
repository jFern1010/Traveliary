-- Traveliary B1: block travelers (App Store guideline 1.2) and delete-my-data.
--
-- Blocking works on anonymous identities: the app blocks "the author of this photo" and never
-- learns who that is. Blocked authors disappear from your galleries, map counts, and pushes.

create table public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;
revoke all on public.blocks from anon, authenticated;

create or replace function public.block_photo_author(p_photo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_author uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  select author_id into v_author from public.photos where id = p_photo_id;
  if not found then
    raise exception 'Photo not found' using errcode = 'P0002';
  end if;
  if v_author = v_uid then
    raise exception 'You can’t block yourself' using errcode = '22023';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (v_uid, v_author)
  on conflict do nothing;
end;
$$;

create or replace function public.my_block_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.blocks where blocker_id = auth.uid();
$$;

create or replace function public.unblock_all()
returns integer
language sql
security definer
set search_path = ''
as $$
  with removed as (
    delete from public.blocks where blocker_id = auth.uid() returning 1
  )
  select count(*)::integer from removed;
$$;

revoke all on function public.block_photo_author(uuid) from public, anon;
grant execute on function public.block_photo_author(uuid) to authenticated;
revoke all on function public.my_block_count() from public, anon;
grant execute on function public.my_block_count() to authenticated;
revoke all on function public.unblock_all() from public, anon;
grant execute on function public.unblock_all() to authenticated;

-- ---------------------------------------------------------------------------
-- Respect blocks everywhere photos are listed.
-- ---------------------------------------------------------------------------

create or replace view public.photos_public as
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
where ph.author_id = auth.uid()
   or (
     ph.status = 'visible'
     and not exists (
       select 1 from public.reports r
       where r.photo_id = ph.id and r.reporter_id = auth.uid()
     )
     and not exists (
       select 1 from public.blocks b
       where b.blocker_id = auth.uid() and b.blocked_id = ph.author_id
     )
   );

-- Map pins: per-viewer counts, so a place with only blocked travelers' photos disappears.
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
  select pl.id, pl.name, pl.country, pl.lat, pl.lng,
         seen.photo_count, seen.last_photo_at, seen.cover_thumb_path,
         extensions.st_distance(pl.centroid, here.point) as distance_m
  from public.places pl
  cross join here
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
    and extensions.st_dwithin(pl.centroid, here.point, least(greatest(p_radius_m, 0), 500000))
  order by distance_m
  limit least(greatest(p_limit, 1), 200);
$$;

-- Push: never notify someone about a photo from a traveler they blocked.
create or replace function public.claim_push_recipients(p_photo_id uuid)
returns table (expo_token text, place_id uuid, place_name text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_photo public.photos;
begin
  select * into v_photo from public.photos where id = p_photo_id;
  if not found or v_photo.status <> 'visible' then
    return;
  end if;

  return query
  with recipients as (
    select distinct ph.author_id as user_id
    from public.photos ph
    where ph.place_id = v_photo.place_id
      and ph.status = 'visible'
      and ph.author_id <> v_photo.author_id
  ),
  eligible as (
    select r.user_id
    from recipients r
    where exists (select 1 from public.push_tokens pt where pt.user_id = r.user_id)
      and not exists (
        select 1 from public.blocks b
        where b.blocker_id = r.user_id and b.blocked_id = v_photo.author_id
      )
      and not exists (
        select 1 from public.notification_log nl
        where nl.user_id = r.user_id
          and nl.place_id = v_photo.place_id
          and nl.sent_at > now() - interval '1 hour'
      )
  ),
  logged as (
    insert into public.notification_log as nl (user_id, place_id, sent_at)
    select e.user_id, v_photo.place_id, now() from eligible e
    on conflict (user_id, place_id) do update set sent_at = now()
    returning nl.user_id
  )
  select pt.expo_token, pl.id, pl.name
  from logged l
  join public.push_tokens pt on pt.user_id = l.user_id
  join public.places pl on pl.id = v_photo.place_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Delete my data. Called by the delete-account Edge Function (service role), which then removes
-- the storage files and the auth user. Returns the storage paths of the deleted photos.
-- ---------------------------------------------------------------------------

create or replace function public.delete_user_data(p_user_id uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paths  text[];
  v_places uuid[];
begin
  select coalesce(array_agg(p), '{}') into v_paths
  from (
    select storage_path as p from public.photos where author_id = p_user_id
    union all
    select thumb_path from public.photos where author_id = p_user_id
  ) paths;

  with deleted as (
    delete from public.photos where author_id = p_user_id returning place_id
  )
  select coalesce(array_agg(distinct place_id), '{}') into v_places from deleted;

  perform public.refresh_place_stats(place) from unnest(v_places) as place;
  delete from public.places pl
  where pl.id = any (v_places)
    and not exists (select 1 from public.photos ph where ph.place_id = pl.id);

  delete from public.push_tokens where user_id = p_user_id;
  delete from public.notification_log where user_id = p_user_id;
  delete from public.reports where reporter_id = p_user_id;
  delete from public.blocks where blocker_id = p_user_id or blocked_id = p_user_id;

  return v_paths;
end;
$$;

revoke all on function public.delete_user_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_user_data(uuid) to service_role;
