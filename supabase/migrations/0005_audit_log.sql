-- Change log: who created, changed or deleted a shift, absence or exchange.
-- Written by triggers, so no code path (client, RPC, job) can skip it. Append-only for everyone.
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  at timestamptz not null default now(),
  actor_employee_id uuid references employees(id) on delete set null,   -- null = system job
  table_name text not null,
  row_id uuid not null,
  action text not null check (action in ('insert','update','delete')),
  old_row jsonb,
  new_row jsonb
);
create index on audit_log (org_id, at desc);
create index on audit_log (row_id);
alter table audit_log enable row level security;
create policy audit_read on audit_log for select using (org_id = app_org_id() and has_perm_any('schedule.edit'));
-- no insert/update/delete policy: only the trigger (security definer) can write

create function audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_row jsonb := to_jsonb(coalesce(new, old));
begin
  if tg_op = 'UPDATE' and to_jsonb(new) - 'updated_at' = to_jsonb(old) - 'updated_at' then return new; end if;  -- touch only
  insert into audit_log (org_id, actor_employee_id, table_name, row_id, action, old_row, new_row)
  values ((v_row->>'org_id')::uuid, app_employee_id(), tg_table_name, (v_row->>'id')::uuid, lower(tg_op),
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end, case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create trigger audit_shifts after insert or update or delete on shifts for each row execute function audit_trigger();
create trigger audit_absences after insert or update or delete on absences for each row execute function audit_trigger();
create trigger audit_exchanges after insert or update or delete on shift_exchanges for each row execute function audit_trigger();

revoke execute on function audit_trigger from public;
