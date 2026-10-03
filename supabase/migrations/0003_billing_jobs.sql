-- Billing state, email outbox and scheduled jobs. Jobs are plain SQL functions so they
-- are idempotent and testable; a cron route (or pg_cron) calls them with the service role.

create table subscriptions (
  org_id uuid primary key references organizations(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'trialing' check (status in ('trialing','active','past_due','canceled','incomplete','unpaid')),
  seats int not null default 1 check (seats >= 0),
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
-- webhook dedupe: Stripe delivers events at least once
create table stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table subscriptions enable row level security;
alter table stripe_events enable row level security;
create policy subscription_read on subscriptions for select using (org_id = app_org_id());
-- writes only by the service role (webhook handler); stripe_events has no client access

alter table notifications add column attempts int not null default 0;
alter table notifications add column last_error text;

-- hand out notifications that still need an email; SKIP LOCKED lets parallel workers coexist
create function claim_notification_emails(p_limit int default 50)
returns table (id uuid, kind text, payload jsonb, email text, first_name text, attempts int)
language sql security definer set search_path = public as $$
  update notifications n set emailed_at = now()
  from (select x.id from notifications x where x.emailed_at is null and x.attempts < 5 order by x.created_at limit p_limit for update skip locked) c,
       employees e
  where n.id = c.id and e.id = n.employee_id and e.active
  returning n.id, n.kind, n.payload, e.email, e.first_name, n.attempts
$$;
-- failed send: put it back with a counter; after 5 attempts it stays as the dead-letter record
create function release_notification(p_id uuid, p_error text) returns void
language sql security definer set search_path = public as $$
  update notifications set emailed_at = null, attempts = attempts + 1, last_error = left(p_error, 500) where id = p_id
$$;

-- one accrual per employee, balance and month: running the job twice changes nothing
create unique index one_accrual_per_month on balance_entries (employee_id, balance_id, effective_on) where kind = 'accrual';

create function accrue_balances(p_month date default date_trunc('month', now())::date) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into balance_entries (org_id, employee_id, balance_id, amount, kind, effective_on, note)
  select e.org_id, e.id, b.id, round(b.default_accrual_per_year * (c.hours_per_week / 40.0) / 12, 2), 'accrual', p_month, 'Maandelijkse opbouw'
  from employees e
  join contracts c on c.employee_id = e.id and p_month between c.starts_on and coalesce(c.ends_on, 'infinity')
  join absence_balances b on b.org_id = e.org_id
  where e.active and b.default_accrual_per_year > 0
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- rolling publish window: departments with a window > 0 publish today .. today+N
create function auto_publish(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into published_days (department_id, day, org_id)
  select d.id, g::date, d.org_id
  from departments d join organizations o on o.id = d.org_id,
       lateral generate_series((p_now at time zone d.timezone)::date, (p_now at time zone d.timezone)::date + coalesce(d.publish_days_ahead, o.publish_days_ahead), interval '1 day') g
  where coalesce(d.publish_days_ahead, o.publish_days_ahead) > 0
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- extend open-ended recurring series up to 90 days ahead, copying the latest shift of the series
create function extend_series(p_today date default current_date) returns int
language plpgsql security definer set search_path = public as $$
declare s shift_series; t shifts; d date; total int := 0; horizon date := p_today + 90; start_week date; n int;
begin
  for s in select * from shift_series where (ends_on is null or ends_on > generated_until) and generated_until < horizon for update loop
    select * into t from shifts where series_id = s.id order by work_date desc limit 1;
    if not found then continue; end if;
    start_week := s.starts_on - (extract(isodow from s.starts_on)::int - 1);
    d := s.generated_until + 1;
    while d <= least(horizon, coalesce(s.ends_on, horizon)) loop
      if extract(isodow from d)::int = any(s.weekdays)
         and (((d - (extract(isodow from d)::int - 1)) - start_week) / 7) % s.every_n_weeks = 0 then
        insert into shifts (org_id, department_id, team_id, shift_type_id, employee_id, series_id, work_date, start_at, end_at,
                            unpaid_break_min, paid_break_min, hide_end_time, description, needed_count)
        values (t.org_id, t.department_id, t.team_id, t.shift_type_id, t.employee_id, s.id, d,
                t.start_at + (d - t.work_date) * interval '1 day', t.end_at + (d - t.work_date) * interval '1 day',
                t.unpaid_break_min, t.paid_break_min, t.hide_end_time, t.description, t.needed_count);
        total := total + 1;
      end if;
      d := d + 1;
    end loop;
    update shift_series set generated_until = least(horizon, coalesce(s.ends_on, horizon)) where id = s.id;
  end loop;
  return total;
end $$;

-- remind employees who gave fewer available days than the department asks for, once per week
create function availability_reminders(p_today date default current_date) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; v_week date := p_today + (8 - extract(isodow from p_today)::int);   -- next Monday
begin
  for r in
    select e.id as emp, e.org_id, d.avail_min_days_per_week as need
    from departments d
    join teams t on t.department_id = d.id
    join employee_teams et on et.team_id = t.id
    join employees e on e.id = et.employee_id and e.active
    where d.avail_min_days_per_week > 0
      and d.avail_remind_days_before is not null
      and v_week - p_today <= d.avail_remind_days_before
      and (select count(*) from availability a where a.employee_id = e.id and a.day between v_week and v_week + 6) < d.avail_min_days_per_week
      and not exists (select 1 from notifications x where x.employee_id = e.id and x.kind = 'availability_reminder' and (x.payload->>'week')::date = v_week)
    group by e.id, e.org_id, d.avail_min_days_per_week
  loop
    perform app_notify(r.org_id, r.emp, 'availability_reminder', jsonb_build_object('week', v_week));
    n := n + 1;
  end loop;
  return n;
end $$;

revoke execute on all functions in schema public from public;
grant execute on function accrue_balances, auto_publish, extend_series, availability_reminders, claim_notification_emails, release_notification to service_role;
