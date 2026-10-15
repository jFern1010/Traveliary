-- Traveliary M6: reporting with auto-hide, accurate place stats, and orphaned-file cleanup.

-- ---------------------------------------------------------------------------
-- Place stats now count *visible* photos only, recomputed from the source of truth.
-- ---------------------------------------------------------------------------

create or replace function public.refresh_place_stats(p_place_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.places pl
  set photo_count = (
        select count(*) from public.photos ph
        where ph.place_id = pl.id and ph.status = 'visible'
      ),
      last_photo_at = (
        select max(ph.created_at) from public.photos ph
        where ph.place_id = pl.id and ph.status = 'visible'
      ),
      cover_photo_id = (
        select ph.id from public.photos ph
        where ph.place_id = pl.id and ph.status = 'visible'
        order by ph.created_at desc
        limit 1
      )
  where pl.id = p_place_id;
$$;

revoke all on function public.refresh_place_stats(uuid) from public, anon, authenticated;

-- Same signature as before; now uses refresh_place_stats so hidden photos are handled correctly.
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

  perform public.refresh_place_stats(v_deleted.place_id);

  -- Don't leave empty places behind.
  delete from public.places
  where id = v_deleted.place_id
    and not exists (select 1 from public.photos where place_id = v_deleted.place_id);

  return array[v_deleted.storage_path, v_deleted.thumb_path];
end;
$$;

-- Bring existing places in line with the visible-only rule.
select public.refresh_place_stats(id) from public.places;

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

create table public.reports (
  photo_id    uuid not null references public.photos (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason      text not null check (reason in ('inappropriate', 'spam', 'privacy', 'wrong_place', 'other')),
  created_at  timestamptz not null default now(),
  primary key (photo_id, reporter_id)
);

alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;

-- Returns 'reported', 'already_reported', or 'hidden' (this report reached the threshold).
create or replace function public.report_photo(p_photo_id uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_hide_threshold constant integer := 3;
  v_uid    uuid := auth.uid();
  v_photo  public.photos;
  v_status text;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select * into v_photo from public.photos where id = p_photo_id for update;
  if not found then
    raise exception 'Photo not found' using errcode = 'P0002';
  end if;
  if v_photo.author_id = v_uid then
    raise exception 'You can delete your own photo instead of reporting it' using errcode = '22023';
  end if;

  insert into public.reports (photo_id, reporter_id, reason)
  values (p_photo_id, v_uid, p_reason)
  on conflict do nothing;
  if not found then
    return 'already_reported';
  end if;

  update public.photos
  set report_count = report_count + 1,
      status = case when report_count + 1 >= c_hide_threshold then 'hidden' else status end
  where id = p_photo_id
  returning status into v_status;

  if v_status = 'hidden' and v_photo.status = 'visible' then
    perform public.refresh_place_stats(v_photo.place_id);
    return 'hidden';
  end if;
  return 'reported';
end;
$$;

revoke all on function public.report_photo(uuid, text) from public, anon;
grant execute on function public.report_photo(uuid, text) to authenticated;

-- Reporters stop seeing what they reported right away (others only after the threshold).
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
   );

-- ---------------------------------------------------------------------------
-- Orphaned files: storage objects with no photo row (interrupted uploads, failed deletes).
-- Only files older than p_min_age are returned, so an upload whose create_photo call is still
-- being retried is never touched (the queue re-uploads both files on every attempt anyway).
-- ---------------------------------------------------------------------------

create or replace function public.list_orphan_photo_files(p_min_age interval default interval '1 day')
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'photos'
    and o.created_at < now() - p_min_age
    and not exists (
      select 1 from public.photos ph
      where ph.storage_path = o.name or ph.thumb_path = o.name
    )
  limit 1000;
$$;

revoke all on function public.list_orphan_photo_files(interval) from public, anon, authenticated;
grant execute on function public.list_orphan_photo_files(interval) to service_role;
