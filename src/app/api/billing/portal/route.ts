import { supabaseServer } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';
import { serverEnv } from '@/lib/server/env';
import { stripeClient } from '@/lib/server/stripe';

export const runtime = 'nodejs';

/** Stripe Customer Portal: change plan, update card, cancel in one click. */
export async function POST() {
  const env = serverEnv();
  const sb = await supabaseServer();
  const user = (await sb.auth.getUser()).data.user;
  if (!user) return new Response('unauthorized', { status: 401 });
  const { data: can } = await sb.rpc('has_perm_any', { perm: 'settings.manage' });
  if (!can) return new Response('forbidden', { status: 403 });
  const { data: sub } = await sb.from('subscriptions').select('stripe_customer_id').maybeSingle(); // RLS: own org only
  if (!sub?.stripe_customer_id) return new Response('no subscription', { status: 404 });
  const portal = await stripeClient(env.STRIPE_SECRET_KEY).billingPortal.sessions.create({ customer: sub.stripe_customer_id, return_url: `${env.APP_URL}/instellingen` });
  return Response.json({ url: portal.url });
}
