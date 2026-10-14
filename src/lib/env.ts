// EXPO_PUBLIC_* variables are inlined at build time from .env.local (restart `npm start` after editing).
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
};

export const isBackendConfigured = Boolean(env.supabaseUrl && env.supabaseKey);
