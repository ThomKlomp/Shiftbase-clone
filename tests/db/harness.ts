import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/** Minimal stand-in for the parts of Supabase the migrations rely on. */
const SUPABASE_STUB = `
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key default gen_random_uuid());
  create or replace function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end $$;
`;

export async function freshDb() {
  const db = new PGlite({ extensions: { btree_gist } });
  await db.exec(SUPABASE_STUB);
  const dir = path.resolve(__dirname, '../../supabase/migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(path.join(dir, f), 'utf8'));
  await db.exec(`grant usage on schema public, auth to authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
`);
  return db;
}

/** Run a callback as a signed-in user (RLS enforced), like Supabase does for the client. */
export async function asUser<T>(db: PGlite, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId ?? ''}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
}
