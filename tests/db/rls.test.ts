import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, freshDb } from './harness';

let db: PGlite;
const U = { adminA: '00000000-0000-0000-0000-00000000000a', empA: '00000000-0000-0000-0000-0000000000a1', emp2A: '00000000-0000-0000-0000-0000000000a2', planA: '00000000-0000-0000-0000-0000000000a3', adminB: '00000000-0000-0000-0000-00000000000b' };
let ids: Record<string, string> = {};

const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const as = <T>(u: string | null, fn: () => Promise<T>) => asUser(db, u, fn);
const fails = async (fn: () => Promise<unknown>, re: RegExp) => { await expect(fn()).rejects.toThrow(re); };

beforeAll(async () => {
  db = await freshDb();
  for (const id of Object.values(U)) await db.query('insert into auth.users (id) values ($1)', [id]);
  // org A via the real sign-up function, org B too
  await as(U.adminA, () => db.query("select bootstrap_org('Org A','Ada','Admin','a@x.nl','Winkel','Kassa')"));
  await as(U.adminB, () => db.query("select bootstrap_org('Org B','Bo','Admin','b@x.nl','Depot','Team')"));
  const [org] = await q<{ id: string }>("select id from organizations where name='Org A'");
  const [dept] = await q<{ id: string }>("select id from departments where org_id=$1", [org.id]);
  const [team] = await q<{ id: string }>("select id from teams where org_id=$1", [org.id]);
  const groups = Object.fromEntries((await q<{ id: string; name: string }>("select id,name from permission_groups where org_id=$1", [org.id])).map((g) => [g.name, g.id]));
  const addEmp = async (user: string, first: string, group: string) => {
    const [e] = await q<{ id: string }>("insert into employees (org_id,user_id,first_name,last_name,email) values ($1,$2,$3,'X',$4) returning id", [org.id, user, first, `${first}@x.nl`]);
    await db.query('insert into employee_departments values ($1,$2,$3,$4)', [e.id, dept.id, groups[group], org.id]);
    await db.query('insert into employee_teams values ($1,$2,$3)', [e.id, team.id, org.id]);
    return e.id;
  };
  ids = { org: org.id, dept: dept.id, team: team.id, empA: await addEmp(U.empA, 'Eva', 'Medewerker'), emp2A: await addEmp(U.emp2A, 'Emma', 'Medewerker'), planA: await addEmp(U.planA, 'Piet', 'Planner') };
  ids.adminA = (await q<{ id: string }>('select id from employees where user_id=$1', [U.adminA]))[0].id;
});

const mkShift = async (employee: string | null, day = '2026-11-02', needed: number | null = null) =>
  (await q<{ id: string }>(`insert into shifts (org_id,department_id,team_id,employee_id,work_date,start_at,end_at,needed_count)
    values ($1,$2,$3,$4,$5::date,($5::date + time '08:00') at time zone 'UTC',($5::date + time '16:00') at time zone 'UTC',$6) returning id`, [ids.org, ids.dept, ids.team, employee, day, needed]))[0].id;

describe('tenant isolation', () => {
  it('a second organisation sees nothing of org A in any table', async () => {
    await mkShift(ids.empA);
    const tables = (await q<{ tablename: string }>("select tablename from pg_tables where schemaname='public'")).map((t) => t.tablename);
    for (const t of tables) {
      const rows = await as(U.adminB, async () => (await db.query(`select * from ${t}`)).rows as Record<string, unknown>[]);
      const leaked = rows.filter((r) => r.org_id === ids.org || r.id === ids.org);
      expect(leaked, `leak in ${t}`).toEqual([]);
    }
  });
  it('anonymous (no user) reads nothing', async () => {
    expect(await as(null, async () => (await db.query('select * from shifts')).rows)).toEqual([]);
    expect(await as(null, async () => (await db.query('select * from employees')).rows)).toEqual([]);
  });
  it('cross-tenant write is refused', async () => {
    await fails(() => as(U.adminB, () => db.query("insert into shifts (org_id,department_id,team_id,work_date,start_at,end_at,needed_count) values ($1,$2,$3,'2026-11-03', now(), now()+interval '1h', 1)", [ids.org, ids.dept, ids.team])), /row-level security/);
    await fails(() => as(U.adminB, () => db.query('select set_published($1, array[$2::date], true)', [ids.dept, '2026-11-02'])), /forbidden/);
  });
});

describe('published schedule', () => {
  it('employee sees own org shifts only on published days; planner sees all', async () => {
    const before = await as(U.empA, async () => (await db.query("select * from shifts where work_date='2026-11-02'")).rows);
    expect(before.length).toBe(0);
    expect((await as(U.planA, async () => (await db.query("select * from shifts where work_date='2026-11-02'")).rows)).length).toBeGreaterThan(0);
    await as(U.planA, () => db.query("select set_published($1, array['2026-11-02'::date], true)", [ids.dept]));
    expect((await as(U.empA, async () => (await db.query("select * from shifts where work_date='2026-11-02'")).rows)).length).toBeGreaterThan(0);
    const n = await q("select * from notifications where kind='publish'");
    expect(n.length).toBeGreaterThan(0);
  });
  it('employee cannot publish or edit shifts', async () => {
    await fails(() => as(U.empA, () => db.query("select set_published($1, array['2026-11-09'::date], true)", [ids.dept])), /forbidden/);
    const r = await as(U.empA, () => db.query("update shifts set description='hack' where work_date='2026-11-02'"));
    expect(r.affectedRows).toBe(0);
  });
});

describe('absence approval', () => {
  const absence = async (amount: number, action = 'leave') => (await q<{ id: string }>(
    `insert into absences (org_id,employee_id,type_id,start_date,end_date,amount,shift_action)
     values ($1,$2,(select id from absence_types where org_id=$1 and name='Vakantie'),'2026-12-01','2026-12-01',$3,$4) returning id`, [ids.org, ids.empA, amount, action]))[0].id;
  const bal = async () => Number((await q<{ s: string }>("select coalesce(sum(amount),0) s from balance_entries where employee_id=$1", [ids.empA]))[0].s);

  it('employee cannot approve own request', async () => {
    const id = await absence(8);
    await fails(() => as(U.empA, () => db.query("select decide_absence($1,'approved')", [id])), /forbidden/);
  });
  it('approval writes one ledger row; second decision is refused', async () => {
    await q("insert into balance_entries (org_id,employee_id,balance_id,amount,kind,effective_on) values ($1,$2,(select id from absence_balances where org_id=$1),40,'accrual','2026-01-01')", [ids.org, ids.empA]);
    const id = await absence(8);
    await as(U.planA, () => db.query("select decide_absence($1,'approved')", [id]));
    expect(await bal()).toBe(32);
    await fails(() => as(U.planA, () => db.query("select decide_absence($1,'approved')", [id])), /already_decided/);
    expect(await bal()).toBe(32);
  });
  it('blocks a negative balance unless overridden', async () => {
    const id = await absence(500);
    await fails(() => as(U.planA, () => db.query("select decide_absence($1,'approved')", [id])), /insufficient_balance/);
    await as(U.planA, () => db.query("select decide_absence($1,'approved', true)", [id]));
    expect(await bal()).toBe(32 - 500);
  });
  it('make_open turns shifts into open shifts', async () => {
    const s = await mkShift(ids.empA, '2026-12-01');
    const id = await absence(8, 'make_open');
    await as(U.planA, () => db.query("select decide_absence($1,'approved', true)", [id]));
    expect((await q<{ employee_id: string | null }>('select employee_id from shifts where id=$1', [s]))[0].employee_id).toBeNull();
  });
  it('employee sees only own ledger', async () => {
    const rows = await as(U.emp2A, async () => (await db.query('select * from balance_entries')).rows);
    expect(rows).toEqual([]);
  });
});

describe('exchanges and open shifts under contention', () => {
  it('first colleague wins; the second is told it was taken', async () => {
    const s = await mkShift(ids.empA, '2026-11-16');
    const [{ request_exchange: xid }] = await as(U.empA, async () => (await db.query<{ request_exchange: string }>('select request_exchange($1)', [s])).rows);
    expect(await as(U.emp2A, async () => (await db.query<{ accept_exchange: string }>('select accept_exchange($1)', [xid])).rows[0].accept_exchange)).toBe('pending_manager');
    await fails(() => as(U.planA, () => db.query('select accept_exchange($1)', [xid])), /taken/);
    await as(U.planA, () => db.query('select decide_exchange($1,true)', [xid]));
    expect((await q<{ employee_id: string }>('select employee_id from shifts where id=$1', [s]))[0].employee_id).toBe(ids.emp2A);
  });
  it('one live exchange per shift; only own shift', async () => {
    const s = await mkShift(ids.empA, '2026-11-17');
    await as(U.empA, () => db.query('select request_exchange($1)', [s]));
    await fails(() => as(U.empA, () => db.query('select request_exchange($1)', [s])), /exchange_exists/);
    await fails(() => as(U.emp2A, () => db.query('select request_exchange($1)', [s])), /forbidden/);
  });
  it('open shift cannot be over-assigned, even by parallel calls', async () => {
    const open = await mkShift(null, '2026-11-18', 1);
    const results = await Promise.allSettled([
      as(U.planA, () => db.query('select assign_open_shift($1,$2)', [open, ids.empA])),
      as(U.planA, () => db.query('select assign_open_shift($1,$2)', [open, ids.emp2A])),
    ]);
    // asUser switches roles on a single connection, so these run one after the other here;
    // the row lock inside assign_open_shift is what protects real concurrent connections.
    expect(results.filter((r) => r.status === 'fulfilled').length).toBe(1);
    expect(Number((await q<{ n: string }>('select count(*) n from shifts where open_source_id=$1', [open]))[0].n)).toBe(1);
  });
});

describe('clock', () => {
  it('one running clock; clock out closes it', async () => {
    await as(U.empA, () => db.query('select clock_in($1)', [ids.dept]));
    await fails(() => as(U.empA, () => db.query('select clock_in($1)', [ids.dept])), /already_clocked_in/);
    await as(U.empA, () => db.query('select clock_out()'));
    await fails(() => as(U.empA, () => db.query('select clock_out()')), /not_clocked_in/);
  });
});

describe('sign up and deletion', () => {
  it('cannot bootstrap twice; deletion anonymises', async () => {
    await fails(() => as(U.adminA, () => db.query("select bootstrap_org('Again','A','B','c@x.nl','D','T')")), /already_member/);
    await as(U.emp2A, () => db.query('select delete_my_account()'));
    const [e] = await q<{ first_name: string; email: string; user_id: string | null }>('select first_name,email,user_id from employees where id=$1', [ids.emp2A]);
    expect(e.user_id).toBeNull();
    expect(e.email).toMatch(/^deleted-/);
  });
});
