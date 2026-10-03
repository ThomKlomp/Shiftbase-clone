-- Access rules for the remaining tables and the transactional write functions.
-- Principle: the browser may READ what RLS allows and write simple own-row data.
-- Everything with side effects (ledger, notifications, assignment) goes through the
-- functions below. They are SECURITY DEFINER, so each one checks who is calling.

-- ============ helpers ============
create function app_employee_id() returns uuid
language sql stable security definer set search_path = public as
$$ select id from employees where user_id = auth.uid() and active limit 1 $$;

create function app_org_id() returns uuid
language sql stable security definer set search_path = public as
$$ select org_id from employees where user_id = auth.uid() and active limit 1 $$;

create function has_perm_any(perm text) returns boolean
language sql stable security definer set search_path = public as
$$
  select exists (
    select 1 from employee_departments ed
    join employees e on e.id = ed.employee_id
    join permission_groups g on g.id = ed.permission_group_id
    where e.user_id = auth.uid() and e.active and perm = any(g.permissions)
  )
$$;

-- departments an employee belongs to through their teams
create function employee_depts(emp uuid) returns setof uuid
language sql stable security definer set search_path = public as
$$ select distinct t.department_id from employee_teams et join teams t on t.id = et.team_id where et.employee_id = emp $$;

create function can_manage_employee(emp uuid, perm text) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from employee_depts(emp) d where has_perm(d, perm)) $$;

create function app_notify(p_org uuid, p_employee uuid, p_kind text, p_payload jsonb) returns void
language sql security definer set search_path = public as
$$ insert into notifications (org_id, employee_id, kind, payload) values (p_org, p_employee, p_kind, p_payload) $$;

-- ============ more read / write policies ============
-- settings tables: read in org (already), write needs settings.manage
create policy settings_write on departments for all using (has_perm(id, 'settings.manage')) with check (has_perm(id, 'settings.manage'));
create policy settings_write on teams for all using (has_perm(department_id, 'settings.manage')) with check (has_perm(department_id, 'settings.manage'));
create policy settings_write on shift_types for all using (has_perm(department_id, 'settings.manage')) with check (has_perm(department_id, 'settings.manage'));
create policy settings_write on locations for all using (org_id = app_org_id() and has_perm_any('settings.manage')) with check (org_id = app_org_id() and has_perm_any('settings.manage'));
create policy settings_write on absence_types for all using (org_id = app_org_id() and has_perm_any('settings.manage')) with check (org_id = app_org_id() and has_perm_any('settings.manage'));
create policy settings_write on absence_balances for all using (org_id = app_org_id() and has_perm_any('settings.manage')) with check (org_id = app_org_id() and has_perm_any('settings.manage'));
create policy settings_write on permission_groups for all using (org_id = app_org_id() and has_perm_any('settings.manage')) with check (org_id = app_org_id() and has_perm_any('settings.manage'));

-- people
create policy employees_manage on employees for all
  using (org_id = app_org_id() and has_perm_any('employees.manage')) with check (org_id = app_org_id() and has_perm_any('employees.manage'));
create policy ed_manage on employee_departments for all
  using (has_perm(department_id, 'employees.manage')) with check (has_perm(department_id, 'employees.manage'));
create policy et_manage on employee_teams for all
  using (exists (select 1 from teams t where t.id = team_id and has_perm(t.department_id, 'employees.manage')))
  with check (exists (select 1 from teams t where t.id = team_id and has_perm(t.department_id, 'employees.manage')));
create policy contracts_read on contracts for select
  using (employee_id = app_employee_id() or can_manage_employee(employee_id, 'employees.manage'));
create policy contracts_write on contracts for all
  using (can_manage_employee(employee_id, 'employees.manage')) with check (can_manage_employee(employee_id, 'employees.manage'));

-- schedule support tables
create policy series_planner on shift_series for all using (org_id = app_org_id() and has_perm_any('schedule.edit')) with check (org_id = app_org_id() and has_perm_any('schedule.edit'));
create policy required_read on required_shifts for select using (org_id = app_org_id());
create policy required_write on required_shifts for all using (has_perm(department_id, 'schedule.edit')) with check (has_perm(department_id, 'schedule.edit'));
create policy published_read on published_days for select using (org_id = app_org_id());
-- published_days is written only by set_published()
create policy invites_read on shift_invites for select
  using (employee_id = app_employee_id() or exists (select 1 from shifts s where s.id = shift_id and has_perm(s.department_id, 'schedule.edit')));
create policy exchanges_read on shift_exchanges for select
  using (from_employee_id = app_employee_id() or to_employee_id = app_employee_id()
         or exists (select 1 from shifts s where s.id = shift_id and has_perm(s.department_id, 'exchange.approve')));
create policy balance_read on balance_entries for select
  using (employee_id = app_employee_id() or can_manage_employee(employee_id, 'absence.approve'));
create policy timesheet_read on timesheet_entries for select
  using (employee_id = app_employee_id() or has_perm(department_id, 'timesheet.approve'));
create policy notifications_update_own on notifications for update
  using (employee_id = app_employee_id()) with check (employee_id = app_employee_id());

-- api_keys: no direct client access at all (service role only)

-- ============ sign up ============
create function bootstrap_org(p_org_name text, p_first text, p_last text, p_email text, p_dept text, p_team text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_loc uuid; v_dept uuid; v_team uuid; v_emp uuid; g_admin uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if exists (select 1 from employees where user_id = auth.uid()) then raise exception 'already_member'; end if;
  insert into organizations (name) values (p_org_name) returning id into v_org;
  insert into locations (org_id, name) values (v_org, 'Hoofdvestiging') returning id into v_loc;
  insert into departments (org_id, location_id, name) values (v_org, v_loc, p_dept) returning id into v_dept;
  insert into teams (org_id, department_id, name) values (v_org, v_dept, p_team) returning id into v_team;
  insert into permission_groups (org_id, name, is_default, permissions) values
    (v_org, 'Beheerder', true, array['schedule.edit','schedule.publish','absence.approve','exchange.approve','exchange.approve_incoming','availability.edit_others','timesheet.approve','employees.manage','settings.manage']) returning id into g_admin;
  insert into permission_groups (org_id, name, is_default, permissions) values
    (v_org, 'Manager', true, array['schedule.edit','schedule.publish','absence.approve','exchange.approve','availability.edit_others','timesheet.approve','employees.manage']),
    (v_org, 'Planner', true, array['schedule.edit','schedule.publish','absence.approve','exchange.approve','availability.edit_others']),
    (v_org, 'Medewerker', true, array[]::text[]);
  insert into employees (org_id, user_id, first_name, last_name, email) values (v_org, auth.uid(), p_first, p_last, p_email) returning id into v_emp;
  insert into employee_departments (employee_id, department_id, permission_group_id, org_id) values (v_emp, v_dept, g_admin, v_org);
  insert into employee_teams (employee_id, team_id, org_id) values (v_emp, v_team, v_org);
  insert into absence_balances (org_id, name, unit, default_accrual_per_year) values (v_org, 'Vakantie-uren', 'hours', 200);
  insert into absence_types (org_id, name, balance_id) select v_org, 'Vakantie', id from absence_balances where org_id = v_org;
  insert into absence_types (org_id, name) values (v_org, 'Ziek');
  return v_org;
end $$;

-- ============ publishing ============
create function set_published(p_dept uuid, p_days date[], p_published boolean, p_notify boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid; d date; v_new date[] := '{}'; r record;
begin
  if not has_perm(p_dept, 'schedule.publish') then raise exception 'forbidden' using errcode = '42501'; end if;
  select org_id into v_org from departments where id = p_dept;
  foreach d in array p_days loop
    if p_published then
      insert into published_days (department_id, day, org_id) values (p_dept, d, v_org) on conflict do nothing;
      if found then v_new := v_new || d; end if;
    else
      delete from published_days where department_id = p_dept and day = d;
    end if;
  end loop;
  if p_published and p_notify and array_length(v_new, 1) > 0 then
    for r in select distinct employee_id from shifts where department_id = p_dept and work_date = any(v_new) and employee_id is not null loop
      perform app_notify(v_org, r.employee_id, 'publish', '{}'::jsonb);
    end loop;
  end if;
end $$;

-- ============ open shifts ============
create function assign_open_shift(p_shift uuid, p_employee uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare s shifts; v_count int; v_new uuid;
begin
  select * into s from shifts where id = p_shift for update;           -- serialise concurrent assignments
  if not found or s.employee_id is not null then raise exception 'not_open'; end if;
  if not has_perm(s.department_id, 'schedule.edit') then raise exception 'forbidden' using errcode = '42501'; end if;
  perform 1 from employees where id = p_employee and org_id = s.org_id;
  if not found then raise exception 'unknown_employee'; end if;
  select count(*) into v_count from shifts where open_source_id = s.id;
  if v_count >= coalesce(s.needed_count, 1) then raise exception 'full'; end if;
  insert into shifts (org_id, department_id, team_id, shift_type_id, employee_id, open_source_id, work_date, start_at, end_at,
                      unpaid_break_min, paid_break_min, hide_end_time, description, created_by)
  values (s.org_id, s.department_id, s.team_id, s.shift_type_id, p_employee, s.id, s.work_date, s.start_at, s.end_at,
          s.unpaid_break_min, s.paid_break_min, s.hide_end_time, s.description, app_employee_id())
  returning id into v_new;
  insert into shift_invites (org_id, shift_id, employee_id, status) values (s.org_id, s.id, p_employee, 'assigned')
    on conflict (shift_id, employee_id) do update set status = 'assigned', updated_at = now();
  if v_count + 1 >= coalesce(s.needed_count, 1) then
    update shift_invites set status = 'declined', updated_at = now() where shift_id = s.id and status <> 'assigned';
  end if;
  perform app_notify(s.org_id, p_employee, 'open_shift', jsonb_build_object('date', s.work_date));
  return v_new;
end $$;

create function respond_open_shift(p_shift uuid, p_action text) returns void
language plpgsql security definer set search_path = public as $$
declare s shifts; v_emp uuid := app_employee_id(); inv shift_invites; v_needs_approval boolean; v_count int; r record;
begin
  select * into s from shifts where id = p_shift for update;
  select * into inv from shift_invites where shift_id = p_shift and employee_id = v_emp;
  if not found or s.employee_id is not null then raise exception 'no_invite'; end if;
  if inv.status = 'assigned' then raise exception 'already_assigned'; end if;
  if p_action = 'decline' then update shift_invites set status = 'declined', updated_at = now() where id = inv.id; return; end if;
  select open_shift_needs_approval into v_needs_approval from departments where id = s.department_id;
  if v_needs_approval then
    update shift_invites set status = 'requested', updated_at = now() where id = inv.id;
    for r in select e.id from employees e where e.org_id = s.org_id and has_perm_for(e.id, s.department_id, 'schedule.edit') loop
      perform app_notify(s.org_id, r.id, 'open_request', jsonb_build_object('date', s.work_date));
    end loop;
  else
    select count(*) into v_count from shifts where open_source_id = s.id;
    if v_count >= coalesce(s.needed_count, 1) then raise exception 'full'; end if;
    insert into shifts (org_id, department_id, team_id, shift_type_id, employee_id, open_source_id, work_date, start_at, end_at,
                        unpaid_break_min, paid_break_min, hide_end_time, description)
    values (s.org_id, s.department_id, s.team_id, s.shift_type_id, v_emp, s.id, s.work_date, s.start_at, s.end_at,
            s.unpaid_break_min, s.paid_break_min, s.hide_end_time, s.description);
    update shift_invites set status = 'assigned', updated_at = now() where id = inv.id;
    if v_count + 1 >= coalesce(s.needed_count, 1) then
      update shift_invites set status = 'declined', updated_at = now() where shift_id = s.id and status <> 'assigned';
    end if;
  end if;
end $$;

-- permission check for an arbitrary employee (used to find who to notify)
create function has_perm_for(emp uuid, dept uuid, perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from employee_departments ed join permission_groups g on g.id = ed.permission_group_id
                 where ed.employee_id = emp and ed.department_id = dept and perm = any(g.permissions))
$$;

-- ============ absence ============
create function decide_absence(p_id uuid, p_status text, p_override boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare a absences; v_type absence_types; v_balance numeric; v_me uuid := app_employee_id();
begin
  if p_status not in ('approved','declined') then raise exception 'bad_status'; end if;
  select * into a from absences where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if not can_manage_employee(a.employee_id, 'absence.approve') then raise exception 'forbidden' using errcode = '42501'; end if;
  if a.status <> 'pending' then raise exception 'already_decided'; end if;
  select * into v_type from absence_types where id = a.type_id;
  if p_status = 'approved' then
    if v_type.balance_id is not null then
      select coalesce(sum(amount), 0) into v_balance from balance_entries where employee_id = a.employee_id and balance_id = v_type.balance_id;
      if v_balance - a.amount < 0 and not p_override then raise exception 'insufficient_balance'; end if;
      insert into balance_entries (org_id, employee_id, balance_id, amount, kind, absence_id, effective_on, note)
        values (a.org_id, a.employee_id, v_type.balance_id, -a.amount, 'usage', a.id, a.start_date, v_type.name);
    end if;
    if a.shift_action = 'remove' then
      delete from shifts where employee_id = a.employee_id and work_date between a.start_date and a.end_date;
    elsif a.shift_action = 'make_open' then
      update shifts set employee_id = null, needed_count = 1, updated_at = now()
        where employee_id = a.employee_id and work_date between a.start_date and a.end_date;
    end if;
  end if;
  update absences set status = p_status, decided_by = v_me, decided_at = now(), updated_at = now() where id = p_id;
  perform app_notify(a.org_id, a.employee_id, 'absence_decision', jsonb_build_object('status', p_status));
end $$;

-- ============ exchanges ============
create function request_exchange(p_shift uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare s shifts; v_me uuid := app_employee_id(); v_id uuid; r record;
begin
  select * into s from shifts where id = p_shift;
  if not found or s.employee_id is distinct from v_me then raise exception 'forbidden' using errcode = '42501'; end if;
  begin
    insert into shift_exchanges (org_id, shift_id, from_employee_id) values (s.org_id, s.id, v_me) returning id into v_id;
  exception when unique_violation then raise exception 'exchange_exists';
  end;
  for r in select distinct et.employee_id from employee_teams et join teams t on t.id = et.team_id
           where t.department_id = s.department_id and et.employee_id <> v_me loop
    perform app_notify(s.org_id, r.employee_id, 'exchange', jsonb_build_object('shift', s.id));
  end loop;
  return v_id;
end $$;

create function accept_exchange(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare x shift_exchanges; s shifts; v_me uuid := app_employee_id(); r record;
begin
  select * into x from shift_exchanges where id = p_id for update;    -- first caller wins
  if not found then raise exception 'not_found'; end if;
  if x.status <> 'pending_colleague' then raise exception 'taken'; end if;
  if x.from_employee_id = v_me then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into s from shifts where id = x.shift_id;
  if not exists (select 1 from employee_depts(v_me) d where d = s.department_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if has_perm(s.department_id, 'exchange.approve_incoming') then
    update shift_exchanges set status = 'approved', to_employee_id = v_me, updated_at = now() where id = x.id;
    update shifts set employee_id = v_me, updated_at = now() where id = s.id;
    perform app_notify(s.org_id, x.from_employee_id, 'exchange', jsonb_build_object('status', 'approved'));
    return 'approved';
  end if;
  update shift_exchanges set status = 'pending_manager', to_employee_id = v_me, updated_at = now() where id = x.id;
  for r in select e.id from employees e where e.org_id = s.org_id and has_perm_for(e.id, s.department_id, 'exchange.approve') loop
    perform app_notify(s.org_id, r.id, 'exchange_review', jsonb_build_object('shift', s.id));
  end loop;
  return 'pending_manager';
end $$;

create function decide_exchange(p_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare x shift_exchanges; s shifts;
begin
  select * into x from shift_exchanges where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  select * into s from shifts where id = x.shift_id for update;
  if not has_perm(s.department_id, 'exchange.approve') then raise exception 'forbidden' using errcode = '42501'; end if;
  if x.status <> 'pending_manager' then raise exception 'not_pending_manager'; end if;
  update shift_exchanges set status = case when p_approve then 'approved' else 'rejected' end, decided_by = app_employee_id(), updated_at = now() where id = x.id;
  if p_approve then update shifts set employee_id = x.to_employee_id, updated_at = now() where id = s.id; end if;
  perform app_notify(s.org_id, x.from_employee_id, 'exchange', jsonb_build_object('status', case when p_approve then 'approved' else 'rejected' end));
end $$;

-- ============ time clock ============
create function clock_in(p_dept uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_me uuid := app_employee_id(); v_id uuid; v_org uuid := app_org_id();
begin
  if not exists (select 1 from employee_depts(v_me) d where d = p_dept) then raise exception 'forbidden' using errcode = '42501'; end if;
  begin
    insert into timesheet_entries (org_id, employee_id, department_id, work_date, start_at)
      values (v_org, v_me, p_dept, (now() at time zone (select timezone from departments where id = p_dept))::date, now()) returning id into v_id;
  exception when unique_violation then raise exception 'already_clocked_in';
  end;
  return v_id;
end $$;

create function clock_out() returns void
language plpgsql security definer set search_path = public as $$
begin
  update timesheet_entries set end_at = now(), updated_at = now() where employee_id = app_employee_id() and end_at is null;
  if not found then raise exception 'not_clocked_in'; end if;
end $$;

-- ============ GDPR: delete or anonymise an account ============
create function delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := app_employee_id();
begin
  -- keep shifts and the ledger for the organisation, remove the person
  update employees set first_name = 'Verwijderd', last_name = 'account', email = 'deleted-' || id || '@invalid', active = false, user_id = null, updated_at = now() where id = v_me;
  delete from notifications where employee_id = v_me;
  delete from availability where employee_id = v_me;
end $$;

-- Functions are executable by signed-in users only
revoke execute on all functions in schema public from public;
grant execute on all functions in schema public to authenticated;
