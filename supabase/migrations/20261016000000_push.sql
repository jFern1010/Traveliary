-- Traveliary M5: push tokens and "new photo at a place you've been" fan-out.
--
-- Flow: photos INSERT → Database Webhook → Edge Function `notify-new-photo`
--       → claim_push_recipients(photo_id) (picks recipients + applies the hourly throttle)
--       → Expo Push API.

-- One row per device. A device that signs in as a different anonymous user moves to that user.
create table public.push_tokens (
  expo_token text primary key
    check (expo_token like 'ExponentPushToken[%]' or expo_token like 'ExpoPushToken[%]'),
  user_id    uuid not null references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

-- Last notification per user and place, for throttling (at most one per place per hour).
create table public.notification_log (
  user_id  uuid not null references auth.users (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  sent_at  timestamptz not null default now(),
  primary key (user_id, place_id)
);

-- RPC-only tables: RLS on with no policies, and no direct grants.
alter table public.push_tokens enable row level security;
alter table public.notification_log enable row level security;
revoke all on public.push_tokens from anon, authenticated;
revoke all on public.notification_log from anon, authenticated;

create or replace function public.register_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  insert into public.push_tokens (expo_token, user_id, updated_at)
  values (p_token, auth.uid(), now())
  on conflict (expo_token) do update set user_id = excluded.user_id, updated_at = now();
end;
$$;

create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens where expo_token = p_token and user_id = auth.uid();
$$;

-- Called by the Edge Function with the service role. Returns the devices to notify for a new
-- photo and records the send, so a burst of photos at one place produces one push per hour.
-- Recipients: everyone else who has posted a visible photo at the same place.
create or replace function public.claim_push_recipients(p_photo_id uuid)
returns table (expo_token text, place_id uuid, place_name text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
-- (The OUT columns expo_token/place_id would otherwise clash with same-named table columns.)
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

-- Removes tokens Expo reports as no longer registered (app deleted, notifications revoked).
create or replace function public.forget_push_tokens(p_tokens text[])
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens where expo_token = any (p_tokens);
$$;

revoke all on function public.register_push_token(text) from public, anon;
grant execute on function public.register_push_token(text) to authenticated;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.unregister_push_token(text) to authenticated;
revoke all on function public.claim_push_recipients(uuid) from public, anon, authenticated;
grant execute on function public.claim_push_recipients(uuid) to service_role;
revoke all on function public.forget_push_tokens(text[]) from public, anon, authenticated;
grant execute on function public.forget_push_tokens(text[]) to service_role;
