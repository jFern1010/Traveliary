-- Traveliary M5: call the notify-new-photo Edge Function after each photo insert.
-- Replaces a dashboard "Database Webhook" (which needs the supabase_functions schema).
--
-- The URL and shared secret live in Supabase Vault, never in this repo. Create them once in the
-- SQL Editor:
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/notify-new-photo', 'notify_new_photo_url');
--   select vault.create_secret('<same value as the WEBHOOK_SECRET function secret>', 'notify_new_photo_secret');
-- Until both exist, the trigger does nothing (posting still works).

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_new_photo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'notify_new_photo_url';
  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'notify_new_photo_secret';

  if v_url is null or v_secret is null then
    return new;
  end if;

  -- Asynchronous: pg_net sends the request after this transaction commits, so posting is never
  -- slowed down or failed by the notification path. Only non-sensitive columns are sent.
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'photos',
      'record', jsonb_build_object(
        'id', new.id,
        'place_id', new.place_id,
        'status', new.status
      )
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

revoke all on function public.notify_new_photo() from public, anon, authenticated;

drop trigger if exists photos_notify_new_photo on public.photos;
create trigger photos_notify_new_photo
  after insert on public.photos
  for each row execute function public.notify_new_photo();
