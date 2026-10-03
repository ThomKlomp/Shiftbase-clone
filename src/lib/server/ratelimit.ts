/**
 * Fixed-window limiter, in memory. Good enough for a single instance and for tests; on
 * serverless, swap the Map for Upstash Redis (same function signature) before launch.
 */
const hits = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  const h = hits.get(key);
  if (!h || now >= h.reset) { hits.set(key, { n: 1, reset: now + windowMs }); return { ok: true, retryAfterSec: 0 }; }
  h.n++;
  return h.n <= limit ? { ok: true, retryAfterSec: 0 } : { ok: false, retryAfterSec: Math.ceil((h.reset - now) / 1000) };
}
export const clientKey = (req: Request, scope: string) => `${scope}:${req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'}`;
export function _resetRateLimit() { hits.clear(); }
