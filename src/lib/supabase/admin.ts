import { createClient } from '@supabase/supabase-js';
import { serverEnv } from '../server/env';

/** Service-role client. Server only: never import this from a client component. */
export function adminClient() {
  const e = serverEnv();
  return createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
