-- Apply one Stripe event atomically: record its id (dedupe) and update the subscription in the
-- same transaction. Stripe retries, so a repeat of an already-applied event must change nothing.
create function apply_stripe_event(
  p_event_id text, p_type text, p_customer text, p_subscription text,
  p_status text, p_seats int, p_period_end timestamptz, p_org uuid default null
) returns text
language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  insert into stripe_events (id, type) values (p_event_id, p_type) on conflict do nothing;
  if not found then return 'duplicate'; end if;

  v_org := coalesce(p_org, (select org_id from subscriptions where stripe_customer_id = p_customer));
  if v_org is null then return 'ignored'; end if;   -- not one of ours (or checkout not seen yet)

  insert into subscriptions (org_id, stripe_customer_id, stripe_subscription_id, status, seats, current_period_end, updated_at)
  values (v_org, p_customer, p_subscription, coalesce(p_status, 'incomplete'), coalesce(p_seats, 1), p_period_end, now())
  on conflict (org_id) do update set
    stripe_customer_id = coalesce(excluded.stripe_customer_id, subscriptions.stripe_customer_id),
    stripe_subscription_id = coalesce(excluded.stripe_subscription_id, subscriptions.stripe_subscription_id),
    status = coalesce(p_status, subscriptions.status),
    seats = coalesce(p_seats, subscriptions.seats),
    current_period_end = coalesce(excluded.current_period_end, subscriptions.current_period_end),
    updated_at = now();
  return 'applied';
end $$;
revoke execute on function apply_stripe_event from public;
grant execute on function apply_stripe_event to service_role;
