import { adminClient } from '@/lib/supabase/admin';
import { serverEnv } from '@/lib/server/env';
import { processOutbox, resendSender } from '@/lib/server/email';
import { timingSafeEqual } from 'node:crypto';

export const runtime = 'nodejs';

const SQL_JOBS: Record<string, string> = { 'auto-publish': 'auto_publish', 'extend-series': 'extend_series', accrual: 'accrue_balances', 'availability-reminders': 'availability_reminders' };

function authorised(req: Request, secret: string) {
  const got = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Called by the host's scheduler (Vercel Cron sends the CRON_SECRET as a bearer token). */
export async function GET(req: Request, { params }: { params: Promise<{ job: string }> }) {
  const env = serverEnv();
  if (!authorised(req, env.CRON_SECRET)) return new Response('unauthorized', { status: 401 });
  const { job } = await params;
  const db = adminClient();
  if (job === 'send-notifications') {
    return Response.json(await processOutbox(db, resendSender(env.RESEND_API_KEY, env.EMAIL_FROM), env.APP_URL));
  }
  const fn = SQL_JOBS[job];
  if (!fn) return new Response('unknown job', { status: 404 });
  const { data, error } = await db.rpc(fn);
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ job, result: data });
}
