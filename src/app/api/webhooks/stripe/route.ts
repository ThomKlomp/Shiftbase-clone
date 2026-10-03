import { adminClient } from '@/lib/supabase/admin';
import { serverEnv } from '@/lib/server/env';
import { handleStripeEvent, stripeClient, verifyStripeEvent } from '@/lib/server/stripe';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const env = serverEnv();
  const raw = await req.text();                       // the signature covers the exact bytes
  let event;
  try { event = verifyStripeEvent(stripeClient(env.STRIPE_SECRET_KEY), raw, req.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET); }
  catch { return new Response('invalid signature', { status: 400 }); }
  try {
    const outcome = await handleStripeEvent(adminClient(), event);
    return Response.json({ received: true, outcome });
  } catch (e) {
    console.error('stripe webhook failed', event.id, e instanceof Error ? e.message : e);   // no payload in logs
    return new Response('handler error', { status: 500 });                                   // Stripe will retry
  }
}
