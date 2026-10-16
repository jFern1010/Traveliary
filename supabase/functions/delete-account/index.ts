// Edge Function: permanently deletes the calling user's photos, files, and anonymous identity.
// Called from the app's About screen with the user's own session (supabase.functions.invoke).
//
// Deploy: npx supabase@latest functions deploy delete-account --no-verify-jwt --use-api
// (JWT is verified here with auth.getUser, which also works with the new signing keys.)

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
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Not signed in' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'Not signed in' }, 401);
  const userId = userData.user.id;

  // 1. Database rows (photos, reports, blocks, push tokens); returns the photo file paths.
  const { data: paths, error: dataError } = await admin.rpc('delete_user_data', { p_user_id: userId });
  if (dataError) {
    console.error('delete_user_data failed', dataError);
    return json({ error: 'Could not delete your data. Please try again.' }, 500);
  }

  // 2. Files: the returned paths plus anything else left in the user's folder.
  const { data: listed } = await admin.storage.from(BUCKET).list(userId, { limit: 1000 });
  const names = new Set<string>([
    ...((paths ?? []) as string[]),
    ...(listed ?? []).map((f) => `${userId}/${f.name}`),
  ]);
  const all = [...names];
  for (let i = 0; i < all.length; i += BATCH) {
    const { error } = await admin.storage.from(BUCKET).remove(all.slice(i, i + BATCH));
    if (error) console.error('storage remove failed', error); // orphans are swept by cleanup-orphans
  }

  // 3. The anonymous identity itself.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error('deleteUser failed', deleteError);
    return json({ error: 'Your photos were deleted, but the identity could not be. Please try again.' }, 500);
  }

  return json({ deleted: true, files: all.length });
});
