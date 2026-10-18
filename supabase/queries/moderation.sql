-- Traveliary moderation. Run in the PROD project's SQL Editor (see docs/beta/moderation.md).
-- Sections 1–2 are read-only. Sections 3–5 CHANGE data: replace the placeholder ID and run one at a time.

-- 1. Reported photos, most reported first (open photo_url in a browser to look at it) -----------
select
  ph.id                                   as photo_id,
  ph.status,
  ph.report_count,
  pl.name                                 as place,
  ph.created_at,
  string_agg(distinct r.reason, ', ')     as reasons,
  max(r.created_at)                       as last_reported_at,
  'https://nxsckznbmcmhlxsxxwsn.supabase.co/storage/v1/object/public/photos/' || ph.storage_path as photo_url,
  ph.author_id
from public.photos ph
join public.places pl on pl.id = ph.place_id
join public.reports r on r.photo_id = ph.id
group by ph.id, pl.name
order by ph.report_count desc, last_reported_at desc;

-- 2. Everything one traveler posted (paste author_id from section 1) -------------------------------
select ph.id as photo_id, ph.status, ph.report_count, pl.name as place, ph.created_at,
       'https://nxsckznbmcmhlxsxxwsn.supabase.co/storage/v1/object/public/photos/' || ph.storage_path as photo_url
from public.photos ph
join public.places pl on pl.id = ph.place_id
where ph.author_id = '00000000-0000-0000-0000-000000000000'
order by ph.created_at desc;

-- 3. Hide one photo (it stays visible to its author, marked "Hidden") ------------------------------
with hidden as (
  update public.photos set status = 'hidden'
  where id = '00000000-0000-0000-0000-000000000000'
  returning place_id
)
select public.refresh_place_stats(place_id) from hidden;

-- 4. Restore a photo that was hidden by mistake (also clears its reports) --------------------------
with restored as (
  update public.photos set status = 'visible', report_count = 0
  where id = '00000000-0000-0000-0000-000000000000'
  returning id, place_id
), cleared as (
  delete from public.reports where photo_id in (select id from restored)
)
select public.refresh_place_stats(place_id) from restored;

-- 5. Hide EVERYTHING from one abusive traveler -------------------------------------------------------
with hidden as (
  update public.photos set status = 'hidden'
  where author_id = '00000000-0000-0000-0000-000000000000' and status = 'visible'
  returning place_id
)
select public.refresh_place_stats(place_id) from (select distinct place_id from hidden) p;
