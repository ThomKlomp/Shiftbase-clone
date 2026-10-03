import { beforeAll, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import type { PGlite } from '@electric-sql/pglite';
import { freshDb, asUser } from '../db/harness';
import { handleStripeEvent, paramsFor, verifyStripeEvent, type Db } from '@/lib/server/stripe';
import { processOutbox, renderEmail, resendSender, type OutboxRow } from '@/lib/server/email';
import { _resetRateLimit, rateLimit } from '@/lib/server/ratelimit';
import { serverEnv } from '@/lib/server/env';

const stripe = new Stripe('sk_test_dummy');
const SECRET = 'whsec_test_secret';
let pg: PGlite;
let org: string;
const USER = '00000000-0000-0000-0000-0000000000d1';

/** Adapter: the same rpc() shape supabase-js has, backed by the real SQL functions in PGlite. */
const rpcFor = (db: PGlite): Db => ({
  rpc: async (fn, args = {}) => {
    const keys = Object.keys(args);
    try {
      const r = await db.query(`select * from ${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(',')})`, keys.map((k) => args[k]));
      const first = r.rows[0] as Record<string, unknown> | undefined;
      const data = r.rows.length === 1 && first && Object.keys(first).length === 1 && Object.keys(first)[0] === fn ? first[fn] : r.rows;
      return { data, error: null };
    } catch (e) { return { data: null, error: { message: (e as Error).message } }; }
  },
});

beforeAll(async () => {
  pg = await freshDb();
  await pg.query('insert into auth.users (id) values ($1)', [USER]);
  await asUser(pg, USER, () => pg.query("select bootstrap_org('Org','Jo','Doe','jo@x.nl','Winkel','Kassa')"));
  org = (await pg.query<{ id: string }>('select id from organizations')).rows[0].id;
});

const event = (type: string, object: Record<string, unknown>, id = `evt_${Math.random().toString(36).slice(2)}`) =>
  ({ id, type, data: { object } }) as unknown as Stripe.Event;
const sub = async () => (await pg.query<{ status: string; seats: number; stripe_customer_id: string }>('select * from subscriptions where org_id=$1', [org])).rows[0];

describe('stripe signature', () => {
  const body = JSON.stringify({ id: 'evt_1', type: 'x', data: { object: {} } });
  it('accepts a correctly signed body', () => {
    const sig = stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET });
    expect(verifyStripeEvent(stripe, body, sig, SECRET).id).toBe('evt_1');
  });
  it('rejects a tampered body, a wrong secret and a missing header', () => {
    const sig = stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET });
    expect(() => verifyStripeEvent(stripe, body + ' ', sig, SECRET)).toThrow();
    expect(() => verifyStripeEvent(stripe, body, sig, 'whsec_other')).toThrow();
    expect(() => verifyStripeEvent(stripe, body, null, SECRET)).toThrow(/missing_signature/);
  });
  it('rejects a stale timestamp (replay)', () => {
    const old = Math.floor(Date.now() / 1000) - 3600;
    const sig = stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET, timestamp: old });
    expect(() => verifyStripeEvent(stripe, body, sig, SECRET)).toThrow();
  });
});

describe('stripe events', () => {
  it('checkout creates the subscription; a repeat of the same event id changes nothing', async () => {
    const e = event('checkout.session.completed', { customer: 'cus_1', subscription: 'sub_1', client_reference_id: org });
    expect(await handleStripeEvent(rpcFor(pg), e)).toBe('applied');
    expect((await sub()).status).toBe('active');
    await pg.query("update subscriptions set status='past_due'");
    expect(await handleStripeEvent(rpcFor(pg), e)).toBe('duplicate');
    expect((await sub()).status).toBe('past_due');                 // not overwritten by the retry
    await pg.query("update subscriptions set status='active'");
  });
  it('subscription.updated maps status, seats and period end', async () => {
    const end = Math.floor(Date.now() / 1000) + 86400 * 30;
    await handleStripeEvent(rpcFor(pg), event('customer.subscription.updated', { id: 'sub_1', customer: 'cus_1', status: 'past_due', items: { data: [{ quantity: 7, current_period_end: end }] } }));
    const s = await sub();
    expect([s.status, s.seats]).toEqual(['past_due', 7]);
  });
  it('payment_failed marks past_due; deleted cancels', async () => {
    await pg.query("update subscriptions set status='active'");
    await handleStripeEvent(rpcFor(pg), event('invoice.payment_failed', { customer: 'cus_1' }));
    expect((await sub()).status).toBe('past_due');
    await handleStripeEvent(rpcFor(pg), event('customer.subscription.deleted', { id: 'sub_1', customer: 'cus_1', status: 'canceled', items: { data: [] } }));
    expect((await sub()).status).toBe('canceled');
  });
  it('an unknown customer is recorded and ignored, not an error', async () => {
    expect(await handleStripeEvent(rpcFor(pg), event('customer.subscription.updated', { id: 'sub_x', customer: 'cus_unknown', status: 'active', items: { data: [] } }))).toBe('ignored');
  });
  it('unrelated event types are ignored but deduped', async () => {
    const e = event('charge.refunded', {});
    expect(await handleStripeEvent(rpcFor(pg), e)).toBe('ignored');
    expect(await handleStripeEvent(rpcFor(pg), e)).toBe('duplicate');
  });
  it('a subscription event can carry the org itself (arrives before checkout)', () => {
    expect(paramsFor(event('customer.subscription.updated', { id: 's', customer: 'c', status: 'trialing', metadata: { org_id: org }, items: { data: [] } }))?.org).toBe(org);
  });
  it('a database error surfaces so the route answers 500 and Stripe retries', async () => {
    const broken: Db = { rpc: async () => ({ data: null, error: { message: 'db down' } }) };
    await expect(handleStripeEvent(broken, event('invoice.payment_failed', { customer: 'c' }))).rejects.toThrow('db down');
  });
  it('clients cannot write subscriptions or read stripe_events', async () => {
    await expect(asUser(pg, USER, () => pg.query("update subscriptions set status='active'"))).resolves.toMatchObject({ affectedRows: 0 });
    expect((await asUser(pg, USER, () => pg.query('select * from stripe_events'))).rows).toEqual([]);
    await expect(asUser(pg, USER, () => pg.query("select apply_stripe_event('e','t','c','s','active',1,null,null)"))).rejects.toThrow(/permission denied/);
  });
});

describe('email', () => {
  const row = (kind: string, payload = {}): OutboxRow => ({ id: 'n1', kind, payload, email: 'a@x.nl', first_name: 'Anna', attempts: 0 });
  it('renders Dutch templates with links and no raw payload', () => {
    const m = renderEmail(row('absence_decision', { status: 'approved' }), 'https://app.example');
    expect(m.subject).toBe('Je verlof is goedgekeurd');
    expect(m.text).toContain('Hoi Anna,');
    expect(m.text).toContain('https://app.example/verlof');
    expect(renderEmail(row('mystery'), 'https://app.example').subject).toBe('Nieuwe melding');
  });
  it('resend sender posts the right request and throws on failure', async () => {
    const f = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    await resendSender('re_key', 'Rooster <no-reply@example.nl>', f as unknown as typeof fetch)('a@x.nl', 'Onderwerp', 'Tekst');
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_key');
    expect(JSON.parse(init.body as string)).toMatchObject({ to: ['a@x.nl'], subject: 'Onderwerp' });
    const bad = vi.fn().mockResolvedValue(new Response('no', { status: 429 }));
    await expect(resendSender('k', 'f', bad as unknown as typeof fetch)('a', 'b', 'c')).rejects.toThrow('resend 429');
  });
  it('outbox: sends once, releases failures, never sends twice', async () => {
    await pg.query('delete from notifications');
    const emp = (await pg.query<{ id: string }>('select id from employees')).rows[0].id;
    await pg.query("select app_notify($1,$2,'publish','{}'::jsonb)", [org, emp]);
    const send = vi.fn().mockRejectedValueOnce(new Error('smtp')).mockResolvedValue(undefined);
    expect(await processOutbox(rpcFor(pg), send, 'https://app.example')).toEqual({ claimed: 1, sent: 0, failed: 1 });
    expect(await processOutbox(rpcFor(pg), send, 'https://app.example')).toEqual({ claimed: 1, sent: 1, failed: 0 });
    expect(await processOutbox(rpcFor(pg), send, 'https://app.example')).toEqual({ claimed: 0, sent: 0, failed: 0 });
    expect(send).toHaveBeenCalledTimes(2);
  });
});

describe('rate limit', () => {
  it('blocks after the limit and recovers after the window', () => {
    _resetRateLimit();
    expect(rateLimit('k', 2, 1000, 0).ok).toBe(true);
    expect(rateLimit('k', 2, 1000, 1).ok).toBe(true);
    const r = rateLimit('k', 2, 1000, 2);
    expect(r).toEqual({ ok: false, retryAfterSec: 1 });
    expect(rateLimit('k', 2, 1000, 1500).ok).toBe(true);
    expect(rateLimit('other', 2, 1000, 2).ok).toBe(true);
  });
});

describe('env and cron auth', () => {
  it('reports every missing variable by name, never the values', () => {
    expect(() => serverEnv({ STRIPE_SECRET_KEY: 'sk_live_supersecret' })).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    try { serverEnv({ STRIPE_SECRET_KEY: 'sk_live_supersecret' }); } catch (e) { expect((e as Error).message).not.toContain('supersecret'); }
  });
  it('cron route answers 401 without the bearer secret', async () => {
    const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a'.repeat(30), SUPABASE_SERVICE_ROLE_KEY: 's'.repeat(30), STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x', STRIPE_PRICE_ID: 'price_x', RESEND_API_KEY: 're_x', EMAIL_FROM: 'a@b.nl', APP_URL: 'https://app.example', CRON_SECRET: 'c'.repeat(32) };
    Object.assign(process.env, env);
    const { GET } = await import('@/app/api/cron/[job]/route');
    const params = Promise.resolve({ job: 'accrual' });
    expect((await GET(new Request('http://x/api/cron/accrual'), { params })).status).toBe(401);
    expect((await GET(new Request('http://x/api/cron/accrual', { headers: { authorization: 'Bearer wrong' } }), { params })).status).toBe(401);
  });
});
