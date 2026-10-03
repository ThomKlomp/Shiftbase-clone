import { expect, it } from 'vitest';
import { freshDb } from './harness';
it('migrations apply', async () => {
  const db = await freshDb();
  const r = await db.query<{ n: number }>("select count(*)::int n from information_schema.tables where table_schema='public'");
  expect(r.rows[0].n).toBeGreaterThanOrEqual(24);
});
