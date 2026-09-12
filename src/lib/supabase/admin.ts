import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './env';

/**
 * Supabase client with the secret key. It skips row-level rules, so only use
 * it in server actions AFTER checking the signed-in user's role.
 */
export function createAdminSupabase() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error('SUPABASE_SECRET_KEY is not set — see .env.example');
  return createClient(SUPABASE_URL, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
