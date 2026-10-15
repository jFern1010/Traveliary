// Edge Function: deletes storage files that no photo row points to (older than 1 day).
// Run manually (or from a scheduler) with the same shared secret as notify-new-photo:
//   curl.exe -X POST https://<ref>.supabase.co/functions/v1/cleanup-orphans -H "x-webhook-secret: <secret>"
//
// Deploy: npx supabase@latest functions deploy cleanup-orphans --no-verify-jwt --use-api

import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKET = 'photos';
const BATCH = 100;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase.rpc('list_orphan_photo_files', { p_min_age: '1 day' });
  if (error) return json({ error: error.message }, 500);

  const names = (data ?? []) as string[];
  let removed = 0;
  for (let i = 0; i < names.length; i += BATCH) {
    const batch = names.slice(i, i + BATCH);
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(batch);
    if (removeError) {
      console.error('remove failed', removeError);
      return json({ removed, error: removeError.message }, 500);
    }
    removed += batch.length;
  }
  return json({ found: names.length, removed });
});
