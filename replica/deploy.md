# Deploy

**Verdict: NOT deployed, and not deployable yet.** Two hard stops, both outside what this environment can do: (1) 6 of 18 must-haves are only partial, including real sign-up/sign-in and the live data layer; (2) no accounts exist (Supabase, Vercel, Stripe, Resend, domain). Claude never buys, signs in or handles live keys; this file is the checklist for when you do.

## Preflight, run 2026-10-03

| check | result |
| --- | --- |
| `next build` (production, Next 16.3.8) | pass |
| `tsc --noEmit` | pass |
| unit + DB + server tests (`npm test`) | 78 pass (RLS, SQL functions, jobs, Stripe, email, domain) |
| browser tests (`npm run e2e`) | 77 pass: flows, edge cases, axe WCAG A/AA on 14 pages x 2 widths, console/4xx/5xx guard |
| parity (`parity.py`) | **59.9 / 100, must-haves 12 of 18: FAIL** |
| brand sweep | clean (names, domains). Original's brand colour never recorded, so colours not swept |
| store listing lint | 0 errors, 0 warnings (draft; no native app) |
| `npm audit --omit=dev` | 0 vulnerabilities |
| secrets in repo | none (`.env*.local` ignored; only a fake key inside a test that checks it is not echoed) |
| open S1/S2 bugs | none (`bugs.md`) |

By hand, **not done**:
- [ ] privacy policy and terms pages live, listing every processor (Supabase, Vercel, Stripe, Resend, analytics)
- [ ] cookie banner: none needed today (no cookies set by the demo; revisit with Supabase auth cookies, which are strictly necessary, and with analytics)
- [ ] account deletion UI (SQL function `delete_my_account()` exists and is tested; no button yet)
- [ ] favicon is a placeholder; no Open Graph image; titles come from `src/lib/brand.ts`
- [ ] name cleared (`brand.md`: trademark, domain and handle checks all "to run")

## What blocks going live (in order)

1. Live data layer + auth screens (`backend.md` items 1 and 2).
2. Remaining must-haves: month view, locations as records, employee CSV import (`parity.md` top five).
3. Privacy/terms pages, account deletion button, name clearance.
4. Real reviews for a chosen niche, so the angle is evidence-based (`feedback.md`).

## When you are ready: the steps only you can do

**Production database.** New Supabase project (not the dev one), EU region, daily backups on. Run migrations in order: `supabase db push` (or paste `supabase/migrations/0001..0005`). Never run them by hand in production without a backup.

**Vercel.** Import this repo, framework Next.js, `main` deploys, PRs get previews. Env vars (names from `.env.example`, live values only here):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`, `CRON_SECRET` (24+ random chars). `vercel.json` already schedules the five cron jobs; Vercel sends `CRON_SECRET` as the bearer token. Note: Vercel's free plan limits cron frequency (the per-minute email job needs a paid plan, or use Supabase pg_cron / an external scheduler).

**Stripe.** Switch to live mode. Create the "Team" product with a monthly and a yearly per-unit price (`pricing.md`), set `STRIPE_PRICE_ID`, add the webhook endpoint `https://<domain>/api/webhooks/stripe` for `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, copy its signing secret to `STRIPE_WEBHOOK_SECRET`. Configure the Customer Portal (cancel on, quantity changes off). Then buy once with a real card and refund it.

**Supabase Auth.** Site URL and redirect URLs set to the production domain; email templates in Dutch in the brand voice; email confirmations on.

**Domain** (after you buy it at any registrar):

| record | name | value |
| --- | --- | --- |
| A | @ | the IP Vercel shows in the domain settings |
| CNAME | www | `cname.vercel-dns.com` |
| TXT | as asked | Vercel's verification value, if requested |

**Email DNS** from Resend: SPF (TXT), DKIM (CNAME/TXT), and DMARC `v=DMARC1; p=none; rua=mailto:you@yourdomain`, tightened to `quarantine` after clean reports. Without these the confirmation mails go to spam. Pick one canonical host (apex or www) and redirect the other; check HTTPS.

**Watch it.** Sentry (errors), an uptime check on `/` and on `/login`, logs retained, Plausible (no cookie banner needed), an alert to your email. First week: look at failed webhook deliveries in Stripe, `notifications` rows with `attempts >= 5` (dead letters), cron run results, and the audit log for anything odd. Do the core flow yourself on the live site, then on your phone.

**Mobile.** No native app. Ship the PWA first (add a manifest and web push). If an app is wanted later: Expo + `eas build` / `eas submit`; you own the Apple ($99/yr) and Google ($25 once) developer accounts.
