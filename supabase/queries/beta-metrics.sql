-- Traveliary beta metrics. Paste into the PROD project's SQL Editor and run one block at a time.
-- Read-only: nothing here changes data.
-- "Traveler" = one anonymous identity = one app install.

-- 1. Overview -----------------------------------------------------------------------------------
select
  (select count(*) from auth.users)                                          as travelers,
  (select count(distinct author_id) from public.photos)                      as travelers_who_posted,
  (select count(*) from public.photos)                                       as photos,
  (select count(*) from public.photos where status = 'hidden')               as hidden_photos,
  (select count(*) from public.places where photo_count > 0)                 as places_with_photos,
  (select count(*) from public.push_tokens)                                  as devices_with_push,
  (select count(*) from public.notification_log)                             as notifications_sent_latest_per_place,
  (select count(*) from public.reports)                                      as reports,
  (select count(*) from public.blocks)                                       as blocks;

-- 2. Posts per traveler (are people posting more than once?) ------------------------------------
select posts, count(*) as travelers
from (
  select author_id, count(*) as posts from public.photos group by author_id
) t
group by posts
order by posts;

-- 3. Coming back: travelers who posted on 2+ different days --------------------------------------
select
  count(*) filter (where active_days >= 2) as posted_on_2plus_days,
  count(*)                                 as posted_at_all
from (
  select author_id, count(distinct (created_at at time zone 'UTC')::date) as active_days
  from public.photos
  group by author_id
) t;

-- 4. Opened the app recently (session refreshed), whether or not they posted ---------------------
select
  count(distinct user_id) filter (where coalesce(refreshed_at, updated_at) > now() - interval '1 day')  as active_last_24h,
  count(distinct user_id) filter (where coalesce(refreshed_at, updated_at) > now() - interval '7 days') as active_last_7d
from auth.sessions;

-- 5. Daily activity --------------------------------------------------------------------------------
select
  (created_at at time zone 'UTC')::date as day,
  count(*)                              as photos,
  count(distinct author_id)             as posters
from public.photos
group by 1
order by 1 desc;

-- 6. Places, busiest first ----------------------------------------------------------------------------
select name, country, photo_count, last_photo_at
from public.places
where photo_count > 0
order by photo_count desc, last_photo_at desc
limit 50;
