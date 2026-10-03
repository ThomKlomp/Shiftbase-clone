import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, freshDb } from './harness';

let db: PGlite;
let org: string, dept: string, team: string, emp: string;
const USER = '00000000-0000-0000-0000-0000000000c1';
const q = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows;
const n = async (sql: string, p: unknown[] = []) => Number((await q<{ n: string }>(sql, p))[0].n);

beforeAll(async () => {
  db = await freshDb();
  await db.query('insert into auth.users (id) values ($1)', [USER]);
  await asUser(db, USER, () => db.query("select bootstrap_org('Org','Jo','Doe','jo@x.nl','Winkel','Kassa')"));
  org = (await q<{ id: string }>('select id from organizations'))[0].id;
  dept = (await q<{ id: string }>('select id from departments'))[0].id;
  team = (await q<{ id: string }>('select id from teams'))[0].id;
  emp = (await q<{ id: string }>('select id from employees'))[0].id;
});

describe('job functions are not callable by signed-in users', () => {
  it('authenticated cannot run accrual or auto-publish', async () => {
    await expect(asUser(db, USER, () => db.query('select accrue_balances()'))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, USER, () => db.query('select auto_publish()'))).rejects.toThrow(/permission denied/);
  });
});

describe('accrue_balances', () => {
  it('accrues once per month, scaled by contract hours', async () => {
    await db.query("insert into contracts (org_id,employee_id,starts_on,hours_per_week) values ($1,$2,'2026-01-01',20)", [org, emp]);
    expect(await n("select accrue_balances('2026-10-01')::int n")).toBe(1);
    expect(await n("select accrue_balances('2026-10-01')::int n")).toBe(0); // idempotent
    const [row] = await q<{ amount: string }>("select amount from balance_entries where kind='accrual'");
    expect(Number(row.amount)).toBeCloseTo((200 * 0.5) / 12, 2);
    expect(await n("select accrue_balances('2026-11-01')::int n")).toBe(1);
  });
  it('skips employees without an active contract', async () => {
    expect(await n("select accrue_balances('2025-06-01')::int n")).toBe(0);
  });
});

describe('auto_publish', () => {
  it('default window is 365 (everything visible); 0 publishes nothing; 3 publishes today..today+3 once', async () => {
    expect(await n("select auto_publish('2026-10-05T10:00:00Z')::int n")).toBe(366);
    await db.query('delete from published_days');
    await db.query('update organizations set publish_days_ahead = 0');
    expect(await n("select auto_publish('2026-10-05T10:00:00Z')::int n")).toBe(0);
    await db.query('update departments set publish_days_ahead = 3 where id=$1', [dept]);
    expect(await n("select auto_publish('2026-10-05T10:00:00Z')::int n")).toBe(4);
    expect(await n("select auto_publish('2026-10-05T10:00:00Z')::int n")).toBe(0);
    expect(await n("select auto_publish('2026-10-06T10:00:00Z')::int n")).toBe(1); // only the new farthest day
  });
});

describe('extend_series', () => {
  it('extends an open-ended weekly series 90 days and is idempotent', async () => {
    const [ser] = await q<{ id: string }>("insert into shift_series (org_id,weekdays,starts_on,generated_until) values ($1,'{1}','2026-10-05','2026-10-05') returning id", [org]);
    await db.query(`insert into shifts (org_id,department_id,team_id,employee_id,series_id,work_date,start_at,end_at)
      values ($1,$2,$3,$4,$5,'2026-10-05','2026-10-05T08:00Z','2026-10-05T16:00Z')`, [org, dept, team, emp, ser.id]);
    const added = await n("select extend_series('2026-10-05')::int n");
    expect(added).toBeGreaterThanOrEqual(12);
    expect(await n("select extend_series('2026-10-05')::int n")).toBe(0);
    const bad = await n("select count(*) n from shifts where series_id=$1 and extract(isodow from work_date) <> 1", [ser.id]);
    expect(bad).toBe(0);
    const [t] = await q<{ d: string }>("select to_char(start_at at time zone 'UTC','HH24:MI') d from shifts where series_id=$1 and work_date='2026-10-12'", [ser.id]);
    expect(t.d).toBe('08:00');
  });
});

describe('availability_reminders', () => {
  it('reminds once per week when the employee gave too few days', async () => {
    await db.query('update departments set avail_min_days_per_week=3, avail_remind_days_before=7 where id=$1', [dept]);
    expect(await n("select availability_reminders('2026-10-05')::int n")).toBe(1);
    expect(await n("select availability_reminders('2026-10-05')::int n")).toBe(0);
  });
});

describe('email outbox', () => {
  it('claims each notification once, releases failures, stops after 5 attempts', async () => {
    await db.query("delete from notifications");
    await db.query("select app_notify($1,$2,'publish','{}')", [org, emp]);
    const first = await q<{ id: string; email: string }>('select * from claim_notification_emails(10)');
    expect(first.length).toBe(1);
    expect((await q('select * from claim_notification_emails(10)')).length).toBe(0);
    for (let i = 0; i < 5; i++) {
      await db.query('select release_notification($1,$2)', [first[0].id, 'smtp down']);
      const c = await q('select * from claim_notification_emails(10)');
      expect(c.length).toBe(i < 4 ? 1 : 0);
    }
    expect(await n("select attempts n from notifications")).toBe(5);
  });
});
