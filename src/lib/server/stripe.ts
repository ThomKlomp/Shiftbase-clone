import Stripe from 'stripe';

export type Db = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };
const STATUS: Record<string, string> = {
  active: 'active', trialing: 'trialing', past_due: 'past_due', canceled: 'canceled', unpaid: 'unpaid',
  incomplete: 'incomplete', incomplete_expired: 'canceled', paused: 'past_due',
};

export function stripeClient(key: string) { return new Stripe(key); }

/** Verifies the signature against the RAW body. Throws if it does not match or is too old. */
export function verifyStripeEvent(stripe: Stripe, rawBody: string, signature: string | null, secret: string): Stripe.Event {
  if (!signature) throw new Error('missing_signature');
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

type Params = { customer: string | null; subscription: string | null; status: string | null; seats: number | null; periodEnd: string | null; org: string | null };

/** Maps the four events we care about to one SQL call. Everything else is recorded and ignored. */
export function paramsFor(event: Stripe.Event): Params | null {
  const o = event.data.object as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  switch (event.type) {
    case 'checkout.session.completed':
      return { customer: o.customer ?? null, subscription: o.subscription ?? null, status: 'active', seats: null, periodEnd: null, org: o.client_reference_id ?? o.metadata?.org_id ?? null };
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const item = o.items?.data?.[0];
      const end = item?.current_period_end ?? o.current_period_end;
      return {
        customer: o.customer, subscription: o.id,
        status: event.type === 'customer.subscription.deleted' ? 'canceled' : STATUS[o.status] ?? 'incomplete',
        seats: item?.quantity ?? null, periodEnd: end ? new Date(end * 1000).toISOString() : null, org: o.metadata?.org_id ?? null,
      };
    }
    case 'invoice.payment_failed':
      return { customer: o.customer, subscription: o.subscription ?? null, status: 'past_due', seats: null, periodEnd: null, org: null };
    default:
      return null;
  }
}

export async function handleStripeEvent(db: Db, event: Stripe.Event): Promise<'applied' | 'duplicate' | 'ignored'> {
  const p = paramsFor(event);
  const { data, error } = await db.rpc('apply_stripe_event', {
    p_event_id: event.id, p_type: event.type, p_customer: p?.customer ?? null, p_subscription: p?.subscription ?? null,
    p_status: p?.status ?? null, p_seats: p?.seats ?? null, p_period_end: p?.periodEnd ?? null, p_org: p?.org ?? null,
  });
  if (error) throw new Error(error.message);   // a thrown error makes the route answer 500, so Stripe retries
  return p ? (data as 'applied' | 'duplicate' | 'ignored') : data === 'duplicate' ? 'duplicate' : 'ignored';
}
