import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';
import { serverEnv } from '@/lib/server/env';
import { stripeClient } from '@/lib/server/stripe';
import { clientKey, rateLimit } from '@/lib/server/ratelimit';

export const runtime = 'nodejs';

/** Starts Stripe Checkout for the caller's organisation. The seat count is counted here, never taken from the client. */
export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, 'checkout'), 10, 60_000);
  if (!rl.ok) return new Response('too many requests', { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } });
  z.object({}).passthrough().parse(await req.json().catch(() => ({})));
  const env = serverEnv();
  const user = (await (await supabaseServer()).auth.getUser()).data.user;
  if (!user) return new Response('unauthorized', { status: 401 });
  const admin = adminClient();
  const { data: me } = await admin.from('employees').select('id, org_id').eq('user_id', user.id).eq('active', true).maybeSingle();
  if (!me) return new Response('forbidden', { status: 403 });
  const { data: can } = await (await supabaseServer()).rpc('has_perm_any', { perm: 'settings.manage' });
  if (!can) return new Response('forbidden', { status: 403 });
  const { count } = await admin.from('employees').select('id', { count: 'exact', head: true }).eq('org_id', me.org_id).eq('active', true);
  const session = await stripeClient(env.STRIPE_SECRET_KEY).checkout.sessions.create({
    mode: 'subscription', client_reference_id: me.org_id, customer_email: user.email,
    line_items: [{ price: env.STRIPE_PRICE_ID, quantity: Math.max(1, count ?? 1) }],
    subscription_data: { metadata: { org_id: me.org_id }, trial_period_days: 14 },
    success_url: `${env.APP_URL}/instellingen?betaald=1`, cancel_url: `${env.APP_URL}/instellingen`,
  });
  return Response.json({ url: session.url });
}
