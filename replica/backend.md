# Backend status

What exists, what was verified and how, and what still needs the owner's accounts.
"Verified" means a test ran it against real Postgres (PGlite) or real library code here, not against live Supabase, Stripe or Resend: no keys exist in this environment.

## Built and verified

| area | where | verified by |
| --- | --- | --- |
| Schema, 24 tables + billing | `supabase/migrations/0001..0004` | applies cleanly on Postgres 16 (PGlite) incl. `btree_gist` exclusion constraint |
| Row level security | `0001` (base), `0002` (the rest) | `tests/db/rls.test.ts`: org B reads nothing of org A in **every** table, anonymous reads nothing, cross-tenant write refused, employee sees only published days. Mutation check: switching RLS off on `shifts` makes 5 tests fail |
| Authorisation inside functions | `0002` (`has_perm`, `can_manage_employee`, each RPC) | employee cannot approve own absence, publish, or assign; wrong-org employee refused |
| Transactional writes | `0002`: `bootstrap_org`, `set_published`, `assign_open_shift`, `respond_open_shift`, `decide_absence`, `request/accept/decide_exchange`, `clock_in/out`, `delete_my_account` | ledger written once, double decision refused, negative balance blocked without override, first colleague wins an exchange, open shift cannot be over-assigned, one running clock |
| Jobs | `0003`: `accrue_balances`, `auto_publish`, `extend_series`, `availability_reminders`; routes in `src/app/api/cron/[job]`, schedule in `vercel.json` | idempotent (second run changes nothing), scaled by contract hours, not callable by signed-in users |
| Email outbox | `0003` `claim_notification_emails` (SKIP LOCKED) + `src/lib/server/email.ts` | sends once, failed sends are released and retried, stops after 5 attempts (dead-letter rows keep `last_error`) |
| Stripe webhook | `src/app/api/webhooks/stripe`, `0004 apply_stripe_event` | real signature check (tampered body, wrong secret, missing header, replayed timestamp all rejected); duplicate event id is a no-op; DB error returns 500 so Stripe retries; clients cannot write subscriptions |
| Checkout + Customer Portal | `src/app/api/billing/*` | type-checked only. Seat count is computed on the server |
| Rate limiting | `src/lib/server/ratelimit.ts` | unit-tested. In-memory: swap for Upstash before running on serverless |
| Env validation | `src/lib/server/env.ts`, `.env.example` | names missing variables, never prints values |
| Dependencies | | `npm audit --omit=dev`: 0 vulnerabilities (Next 16.3.8) |

## NOT done (needs keys, or is bigger than the time here)

1. **Live data layer.** The app still runs on the in-browser demo store (`src/lib/api.ts`). Swapping to Supabase means: (a) `loadState()` reading the tables through RLS into the same `State` shape, (b) each api function calling the RPCs above or a table write, converting local date+time to `timestamptz` with the department timezone, (c) the remaining RPCs not yet written: create/update/delete shift with scope, copy week, invites, availability upsert, absence request, required shifts, settings. This is the main remaining engineering task. Nothing in the screens needs to change.
2. **Auth screens.** Sign up with email verification, password reset, magic link, sign out everywhere, MFA. `supabaseBrowser/Server` clients exist, `bootstrap_org` handles first-user setup, but there is no middleware or pages yet. The demo person-picker stays until then.
3. **Accounts the owner must create:** Supabase project (run the four migrations in order), Stripe account (test mode first: a per-seat price and a webhook endpoint pointing at `/api/webhooks/stripe` for the four events), Resend account with a verified sending domain, a Vercel project (cron + env vars). Claude never creates these or handles secrets.
4. **Plan enforcement.** `subscriptions.status` is kept in sync, but nothing yet limits a free plan (employees, departments) or blocks writes when `canceled`. Needs the pricing decision from the launch step.
5. **Uploads.** None exist yet (employee files). When added: size/type limits and a separate bucket.
6. **Integrations.** None of the matrix rows with `integrations` are built. If calendar sync is added, Google OAuth verification takes weeks: start it first. An ICS feed per employee needs no OAuth and is the cheap first version.
7. **Backups / PITR.** Check that the Supabase plan has daily backups switched on.
8. **Privacy policy** must list Supabase, Vercel, Stripe, Resend and any analytics as processors.

## Security checklist

- [x] secrets only in env vars, `.env*.local` in `.gitignore`, service-role client only under `src/lib/supabase/admin.ts`
- [~] input validated on the server: webhook and cron verify their own inputs, SQL functions validate; zod used for env and checkout. The remaining routes do not exist yet (see 1)
- [x] authorisation on every read and write, tested with a second organisation and a second employee
- [~] rate limits: checkout done; auth and invite routes do not exist yet
- [x] webhooks verify signatures and dedupe by event id
- [ ] uploads (none yet)
- [x] no user data in URLs or logs (webhook logs event id and message only)
- [x] dependencies audited
- [ ] privacy policy (launch step)

## Run the checks

```bash
npm test          # 68 tests: domain, RLS, SQL functions, jobs, Stripe, email
npm run e2e       # Playwright flows against the built demo app
```
