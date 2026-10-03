-- Workforce scheduling clone: core loop schema (Postgres / Supabase).
-- Times: timestamptz in UTC. Shift dates are local calendar dates of the department
-- (departments.timezone) so a "Monday shift" stays Monday across DST.
-- Access: row level security, tenant = organization. Helper functions below.

create extension if not exists btree_gist;

-- ============ tenancy and structure ============

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  publish_days_ahead int not null default 365 check (publish_days_ahead between 0 and 365),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on locations (org_id);

create table departments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id) on delete restrict,
  name text not null,
  timezone text not null default 'Europe/Amsterdam',
  sort_order int not null default 0,
  -- per-department rules ("variations")
  publish_days_ahead int check (publish_days_ahead between 0 and 365), -- null = org default
  shift_requires_approval boolean not null default true,   -- open shift claims
  avail_edit_deadline_days int,                             -- days before week start
  avail_remind_days_before int,
  avail_min_days_per_week int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on departments (org_id);
create index on departments (location_id);

create table teams (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  department_id uuid not null references departments(id) on delete cascade,
  name text not null,
  kind text not null default 'default' check (kind in ('default','flexpool','hidden')),
  colour text not null default '#64748b',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on teams (org_id);
create index on teams (department_id);

-- ============ people and permissions ============

create table permission_groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  -- e.g. 'schedule.edit','schedule.publish','absence.approve','exchange.approve',
  -- 'exchange.approve_incoming','availability.edit_others','timesheet.approve','employees.manage','settings.manage'
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, name)
);

create table employees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete set null, -- null until invite accepted
  first_name text not null,
  last_name text not null,
  email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, email)
);
create index on employees (org_id);

-- an employee belongs to departments (and teams), with a permission group per department
create table employee_departments (
  employee_id uuid not null references employees(id) on delete cascade,
  department_id uuid not null references departments(id) on delete cascade,
  permission_group_id uuid not null references permission_groups(id) on delete restrict,
  org_id uuid not null references organizations(id) on delete cascade,
  primary key (employee_id, department_id)
);
create index on employee_departments (department_id);
create index on employee_departments (org_id);

create table employee_teams (
  employee_id uuid not null references employees(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  primary key (employee_id, team_id)
);
create index on employee_teams (team_id);

create table contracts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  starts_on date not null,
  ends_on date,
  hours_per_week numeric(5,2) not null check (hours_per_week >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on),
  -- no overlapping contracts per employee
  exclude using gist (employee_id with =, daterange(starts_on, ends_on, '[]') with &&)
);
create index on contracts (org_id);

-- ============ schedule ============

create table shift_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  department_id uuid not null references departments(id) on delete cascade,
  name text not null,
  short_name text,
  start_time time not null,
  end_time time not null,
  unpaid_break_min int not null default 0 check (unpaid_break_min >= 0),
  paid_break_min int not null default 0 check (paid_break_min >= 0),
  colour text not null default '#3b82f6',
  hide_end_time boolean not null default false,
  is_task boolean not null default false,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on shift_types (org_id);
create index on shift_types (department_id);

-- recurrence: a series generates shift rows (materialised, so edits stay per row)
create table shift_series (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  weekdays int[] not null,                -- 1=Mon..7=Sun
  every_n_weeks int not null default 1 check (every_n_weeks >= 1),
  starts_on date not null,
  ends_on date,                           -- null = never, generation job extends horizon
  generated_until date not null,
  created_at timestamptz not null default now()
);
create index on shift_series (org_id);

create table shifts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  department_id uuid not null references departments(id) on delete cascade,
  team_id uuid not null references teams(id) on delete restrict,
  shift_type_id uuid references shift_types(id) on delete set null,
  employee_id uuid references employees(id) on delete set null, -- null = open shift
  series_id uuid references shift_series(id) on delete set null,
  open_source_id uuid references shifts(id) on delete set null, -- assigned copy of an open shift
  work_date date not null,                -- local date in department timezone
  start_at timestamptz not null,
  end_at timestamptz not null,
  unpaid_break_min int not null default 0 check (unpaid_break_min >= 0),
  paid_break_min int not null default 0 check (paid_break_min >= 0),
  hide_end_time boolean not null default false,
  description text,
  needed_count int check (needed_count >= 1),  -- only for open shifts
  created_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at),
  check ((employee_id is null) = (needed_count is not null))
);
create index on shifts (org_id, work_date);
create index on shifts (department_id, work_date);
create index on shifts (team_id);
create index on shifts (employee_id, start_at);
create index on shifts (series_id);
create index on shifts (open_source_id);
-- overlapping shifts per employee are a WARNING in the UI (planners may allow it), not a constraint

create table shift_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  shift_id uuid not null references shifts(id) on delete cascade,  -- the open shift
  employee_id uuid not null references employees(id) on delete cascade,
  status text not null default 'invited'
    check (status in ('invited','requested','declined','assigned')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (shift_id, employee_id)
);
create index on shift_invites (org_id);
create index on shift_invites (employee_id, status);

create table required_shifts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  department_id uuid not null references departments(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  shift_type_id uuid references shift_types(id) on delete set null,
  work_date date not null,
  start_time time,
  end_time time,
  instances int not null default 1 check (instances >= 1),
  needed_mode text not null default 'exact' check (needed_mode in ('min','max','exact')),
  needed_count int not null default 1 check (needed_count >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on required_shifts (org_id);
create index on required_shifts (department_id, work_date);
create index on required_shifts (team_id);

-- publication is per department per day; shifts on unpublished days are hidden from employees
create table published_days (
  department_id uuid not null references departments(id) on delete cascade,
  day date not null,
  org_id uuid not null references organizations(id) on delete cascade,
  published_at timestamptz not null default now(),
  primary key (department_id, day)
);
create index on published_days (org_id);

-- ============ availability ============

create table availability (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('available_all_day','available_from','unavailable_all_day','unavailable_from')),
  from_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, day),
  check ((kind in ('available_from','unavailable_from')) = (from_time is not null))
);
create index on availability (org_id, day);

-- ============ absence ============

create table absence_balances (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  unit text not null default 'hours' check (unit in ('hours','days')),
  default_accrual_per_year numeric(7,2) not null default 0,
  expires_after_months int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on absence_balances (org_id);

create table absence_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  balance_id uuid references absence_balances(id) on delete set null, -- null = no balance (e.g. sick)
  colour text not null default '#f59e0b',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on absence_types (org_id);
create index on absence_types (balance_id);

-- balance is a ledger: accrual, usage, corrections, expiry. Never edit rows, append.
create table balance_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  balance_id uuid not null references absence_balances(id) on delete cascade,
  amount numeric(8,2) not null,                     -- in the balance unit, signed
  kind text not null check (kind in ('accrual','usage','correction','expiry')),
  absence_id uuid,                                  -- set for 'usage' (fk added below)
  effective_on date not null,
  note text,
  created_at timestamptz not null default now()
);
create index on balance_entries (org_id);
create index on balance_entries (employee_id, balance_id, effective_on);

create table absences (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  type_id uuid not null references absence_types(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  partial_start_time time,                          -- partial day on first day
  amount numeric(8,2) not null check (amount > 0),  -- hours or days, per balance unit
  note text,
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  decided_by uuid references employees(id) on delete set null,
  decided_at timestamptz,
  shift_action text not null default 'leave' check (shift_action in ('leave','remove','make_open')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index on absences (org_id, start_date);
create index on absences (employee_id, start_date);
create index on absences (type_id);
create index on absences (status) where status = 'pending';
alter table balance_entries add foreign key (absence_id) references absences(id) on delete cascade;

-- ============ exchanges ============

create table shift_exchanges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  shift_id uuid not null references shifts(id) on delete cascade,
  from_employee_id uuid not null references employees(id) on delete cascade,
  to_employee_id uuid references employees(id) on delete set null,   -- set when a colleague accepts
  status text not null default 'pending_colleague'
    check (status in ('pending_colleague','pending_manager','approved','rejected','cancelled')),
  decided_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on shift_exchanges (org_id);
create index on shift_exchanges (shift_id);
create index on shift_exchanges (from_employee_id);
-- only one live exchange per shift
create unique index one_live_exchange_per_shift on shift_exchanges (shift_id)
  where status in ('pending_colleague','pending_manager');

-- ============ timesheets (should) ============

create table timesheet_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  department_id uuid not null references departments(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  shift_id uuid references shifts(id) on delete set null,
  work_date date not null,
  start_at timestamptz not null,
  end_at timestamptz,                               -- null while clocked in
  unpaid_break_min int not null default 0,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  approved_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at is null or end_at > start_at)
);
create index on timesheet_entries (org_id, work_date);
create index on timesheet_entries (employee_id, work_date);
create index on timesheet_entries (department_id);
create index on timesheet_entries (shift_id);
-- one running clock per employee
create unique index one_open_clock_per_employee on timesheet_entries (employee_id) where end_at is null;

-- ============ notifications, api keys ============

create table notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications (employee_id, created_at desc);
create index on notifications (org_id);
create index on notifications (emailed_at) where emailed_at is null;

create table api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  token_hash text not null unique,            -- store a hash, show the key once
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index on api_keys (org_id);

-- ============ access rules (row level security) ============
-- Rule 1: you can only touch rows of your own organization.
-- Rule 2: writes need the right permission in the row's department.
-- Rule 3: employees only read PUBLISHED shifts; own availability/absences/exchanges.

create function current_employee_ids() returns setof uuid
language sql stable security definer set search_path = public as
$$ select id from employees where user_id = auth.uid() and active $$;

create function current_org_ids() returns setof uuid
language sql stable security definer set search_path = public as
$$ select org_id from employees where user_id = auth.uid() and active $$;

create function has_perm(dept uuid, perm text) returns boolean
language sql stable security definer set search_path = public as
$$
  select exists (
    select 1
    from employee_departments ed
    join employees e on e.id = ed.employee_id
    join permission_groups g on g.id = ed.permission_group_id
    where e.user_id = auth.uid() and e.active
      and ed.department_id = dept
      and (perm = any(g.permissions) or 'admin' = any(g.permissions))
  )
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'organizations','locations','departments','teams','permission_groups','employees',
    'employee_departments','employee_teams','contracts','shift_types','shift_series','shifts',
    'shift_invites','required_shifts','published_days','availability','absence_balances',
    'absence_types','balance_entries','absences','shift_exchanges','timesheet_entries',
    'notifications','api_keys'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Baseline: read within own org (tables without finer rules below).
-- NOTE: organizations has no org_id column, so it uses id.
create policy org_read on organizations for select using (id in (select current_org_ids()));
create policy org_read on locations for select using (org_id in (select current_org_ids()));
create policy org_read on departments for select using (org_id in (select current_org_ids()));
create policy org_read on teams for select using (org_id in (select current_org_ids()));
create policy org_read on shift_types for select using (org_id in (select current_org_ids()));
create policy org_read on absence_types for select using (org_id in (select current_org_ids()));
create policy org_read on absence_balances for select using (org_id in (select current_org_ids()));
create policy org_read on permission_groups for select using (org_id in (select current_org_ids()));
create policy org_read on employees for select using (org_id in (select current_org_ids()));
create policy org_read on employee_departments for select using (org_id in (select current_org_ids()));
create policy org_read on employee_teams for select using (org_id in (select current_org_ids()));

-- Shifts: planners see all in their department; employees see published days only.
create policy shifts_read on shifts for select using (
  has_perm(department_id, 'schedule.edit')
  or (
    org_id in (select current_org_ids())
    and exists (select 1 from published_days p
                where p.department_id = shifts.department_id and p.day = shifts.work_date)
  )
);
create policy shifts_write on shifts for all
  using (has_perm(department_id, 'schedule.edit'))
  with check (has_perm(department_id, 'schedule.edit'));

-- Availability / absences / timesheets: own rows, or manager permission in the department.
create policy availability_own on availability for all
  using (employee_id in (select current_employee_ids()))
  with check (employee_id in (select current_employee_ids()));
create policy availability_planner_read on availability for select
  using (exists (select 1 from employee_departments ed
                 where ed.employee_id = availability.employee_id
                   and has_perm(ed.department_id, 'schedule.edit')));

create policy absences_own on absences for select
  using (employee_id in (select current_employee_ids()));
create policy absences_insert_own on absences for insert
  with check (employee_id in (select current_employee_ids()) and status = 'pending');
create policy absences_manager on absences for all
  using (exists (select 1 from employee_departments ed
                 where ed.employee_id = absences.employee_id
                   and has_perm(ed.department_id, 'absence.approve')));

create policy notifications_own on notifications for select
  using (employee_id in (select current_employee_ids()));

-- Everything else (contracts, invites, exchanges, timesheets, api_keys, series, required
-- shifts, published_days, ledger) is accessed ONLY through server routes that use the service
-- role after an explicit authorisation check (see architecture.md). RLS above with no further
-- policies denies direct client access by default.
