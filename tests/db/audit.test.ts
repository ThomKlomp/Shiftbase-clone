import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, freshDb } from './harness';

let db: PGlite;
const PLAN = '00000000-0000-0000-0000-0000000000e1', EMP = '00000000-0000-0000-0000-0000000000e2', OTHER = '00000000-0000-0000-0000-0000000000e3';
let org: string, dept: string, team: string, planner: string, emp: string, shift: string;
const q = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows;
const as = <T>(u: string, fn: () => Promise<T>) => asUser(db, u, fn);

beforeAll(async () => {
  db = await freshDb();
  for (const u of [PLAN, EMP, OTHER]) await db.query('insert into auth.users (id) values ($1)', [u]);
  await as(PLAN, () => db.query("select bootstrap_org('Org','Pia','Plan','p@x.nl','Winkel','Kassa')"));
  await as(OTHER, () => db.query("select bootstrap_org('Org B','Otto','Other','o@x.nl','D','T')"));
  org = (await q<{ id: string }>("select id from organizations where name='Org'"))[0].id;
  dept = (await q<{ id: string }>('select id from departments where org_id=$1', [org]))[0].id;
  team = (await q<{ id: string }>('select id from teams where org_id=$1', [org]))[0].id;
  planner = (await q<{ id: string }>('select id from employees where user_id=$1', [PLAN]))[0].id;
  const g = (await q<{ id: string }>("select id from permission_groups where org_id=$1 and name='Medewerker'", [org]))[0].id;
  emp = (await q<{ id: string }>("insert into employees (org_id,user_id,first_name,last_name,email) values ($1,$2,'Eva','E','e@x.nl') returning id", [org, EMP]))[0].id;
  await db.query('insert into employee_departments values ($1,$2,$3,$4)', [emp, dept, g, org]);
  await db.query('insert into employee_teams values ($1,$2,$3)', [emp, team, org]);
  await as(PLAN, async () => { shift = (await db.query<{ id: string }>(`insert into shifts (org_id,department_id,team_id,employee_id,work_date,start_at,end_at) values ($1,$2,$3,$4,'2026-11-02','2026-11-02T08:00Z','2026-11-02T16:00Z') returning id`, [org, dept, team, emp])).rows[0].id; });
});

describe('audit log', () => {
  it('records create, change and delete with the acting employee', async () => {
    await as(PLAN, () => db.query("update shifts set start_at='2026-11-02T09:00Z' where id=$1", [shift]));
    await as(PLAN, () => db.query('delete from shifts where id=$1', [shift]));
    const rows = await q<{ action: string; actor_employee_id: string }>('select action, actor_employee_id from audit_log where row_id=$1 order by at, id', [shift]);
    expect(rows.map((r) => r.action).sort()).toEqual(['delete', 'insert', 'update']);
    expect(new Set(rows.map((r) => r.actor_employee_id))).toEqual(new Set([planner]));
  });
  it('a touch of updated_at alone is not logged', async () => {
    await as(PLAN, async () => { shift = (await db.query<{ id: string }>(`insert into shifts (org_id,department_id,team_id,employee_id,work_date,start_at,end_at) values ($1,$2,$3,$4,'2026-11-03','2026-11-03T08:00Z','2026-11-03T16:00Z') returning id`, [org, dept, team, emp])).rows[0].id; });
    await as(PLAN, () => db.query('update shifts set updated_at = now() + interval \'1 minute\' where id=$1', [shift]));
    expect((await q('select 1 from audit_log where row_id=$1', [shift])).length).toBe(1);
  });
  it('approving an absence is logged with the decider', async () => {
    const [a] = await q<{ id: string }>("insert into absences (org_id,employee_id,type_id,start_date,end_date,amount) values ($1,$2,(select id from absence_types where org_id=$1 and name='Ziek'),'2026-12-01','2026-12-01',8) returning id", [org, emp]);
    await as(PLAN, () => db.query("select decide_absence($1,'approved')", [a.id]));
    const rows = await q<{ actor_employee_id: string; action: string }>("select actor_employee_id, action from audit_log where row_id=$1 order by at", [a.id]);
    expect(rows.at(-1)).toMatchObject({ action: 'update', actor_employee_id: planner });
  });
  it('planners read their own organisation only; employees and other orgs read nothing', async () => {
    expect((await as(PLAN, async () => (await db.query('select * from audit_log')).rows)).length).toBeGreaterThan(0);
    expect(await as(EMP, async () => (await db.query('select * from audit_log')).rows)).toEqual([]);
    expect(await as(OTHER, async () => (await db.query('select * from audit_log')).rows)).toEqual([]);
  });
  it('nobody can edit or delete the log through the API', async () => {
    for (const u of [PLAN, EMP]) {
      await expect(as(u, () => db.query("update audit_log set action='insert'"))).resolves.toMatchObject({ affectedRows: 0 });
      await expect(as(u, () => db.query('delete from audit_log'))).resolves.toMatchObject({ affectedRows: 0 });
      await expect(as(u, () => db.query("insert into audit_log (org_id,table_name,row_id,action) values ($1,'x',gen_random_uuid(),'insert')", [org]))).rejects.toThrow(/row-level security/);
    }
  });
});
