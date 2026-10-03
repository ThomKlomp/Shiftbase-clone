import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Per-request client acting as the signed-in user (RLS applies). Session lives in http-only cookies. */
export async function supabaseServer() {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => { try { list.forEach(({ name, value, options }) => jar.set(name, value, options)); } catch { /* called from a Server Component: middleware refreshes */ } },
    },
  });
}
