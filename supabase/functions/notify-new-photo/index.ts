// Edge Function: called by the photos INSERT trigger (pg_net; see the photo_insert_trigger migration).
// Sends "New photo in <place>" to everyone else who has posted at that place (max 1/hour/place).
//
// Deploy:  npx supabase@latest functions deploy notify-new-photo --no-verify-jwt --use-api
// Secret:  npx supabase@latest secrets set WEBHOOK_SECRET=<random string>
// The trigger sends the same value (Vault secret notify_new_photo_secret) in `x-webhook-secret`.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { buildMessages, chunk, deadTokens, EXPO_BATCH_SIZE, type Recipient } from './messages.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: { id: string; status: string } | null;
};

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

  const payload = (await req.json()) as WebhookPayload;
  if (payload.type !== 'INSERT' || payload.table !== 'photos' || !payload.record) {
    return json({ skipped: 'not a photo insert' });
  }
  if (payload.record.status !== 'visible') {
    return json({ skipped: 'photo not visible' });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase.rpc('claim_push_recipients', {
    p_photo_id: payload.record.id,
  });
  if (error) {
    console.error('claim_push_recipients failed', error);
    return json({ error: error.message }, 500);
  }

  const messages = buildMessages((data ?? []) as Recipient[]);
  const toForget: string[] = [];
  for (const batch of chunk(messages, EXPO_BATCH_SIZE)) {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) console.error('Expo push failed', response.status, body);
    toForget.push(...deadTokens(batch, body));
  }

  if (toForget.length > 0) {
    const { error: forgetError } = await supabase.rpc('forget_push_tokens', { p_tokens: toForget });
    if (forgetError) console.error('forget_push_tokens failed', forgetError);
  }

  return json({ sent: messages.length, forgotten: toForget.length });
});
