# Test plan

Tested: our clone only (never the original's servers). Demo mode (in-browser store) via Playwright; SQL and server code via Vitest on real Postgres (PGlite). IDs: flow-type-number. H = happy, E = edge, N = negative.
Run: `npm test` (68+2 unit/db/server) and `npm run e2e` (67 browser tests; the specs also fail on any console error, any same-origin 4xx/5xx, and run an axe WCAG 2 A/AA scan).

| case | what | how | result |
| --- | --- | --- | --- |
| F01-H1 | planner adds a shift, publishes, employee sees it and the notification | e2e `flows` | pass |
| F01-H2 | employee sees nothing before publish | e2e | pass |
| F01-H3 | recurring shift creates series; edit "this" vs "future" | unit | pass |
| F01-H4 | copy week | unit | pass |
| F01-E1 | double click on save creates one shift | e2e `edge` | pass |
| F01-E2 | two tabs do not overwrite each other | e2e | **BUG-3, fixed** |
| F01-E3 | 60 chars + emoji name: no horizontal overflow | e2e | pass |
| F01-E4 | no sideways page scroll on any page at 390px | e2e | **BUG-1, fixed** |
| F01-E5 | refresh and back button | e2e | pass |
| F01-E6 | conflicts are warnings (overlap, leave, unavailable); available-from | unit | pass |
| F01-E7 | keyboard only: open shift form from the grid, Esc closes | e2e | pass |
| F01-E8 | end equals start rejected; overnight shift hours | e2e + unit | pass |
| F01-E9 | DST nights: 7 distinct week days, no skipped date | e2e (clock set to 25 Oct) + unit | pass |
| F01-E10 | rolling publish window boundaries (day N / N+1) | unit | pass |
| F01-N1 | employee cannot create or publish | unit + e2e | pass |
| F02-H1 | request leave, planner approves, balance down, delete restores | unit + SQL | pass |
| F02-E1 | balance too low: warning, block, override | unit + e2e + SQL | pass |
| F02-E2 | absence within 7 days of another warns | unit | pass |
| F02-E3 | make_open turns the employee's shifts into open shifts | unit + SQL | pass |
| F02-N1 | zero hours, end before start | e2e | pass |
| F02-N2 | employee cannot approve own; decided request is final | unit + SQL | pass |
| F03-H1 | availability shows green/grey in planner grid | e2e | pass |
| F04-H1 | open shift: invite, request, assign (approval mode) | e2e + unit + SQL | pass |
| F04-E1 | first-come-first-served closes when full; no over-assign | unit + SQL | pass |
| F05-H1 | exchange: request, accept, manager approves | e2e + unit + SQL | pass |
| F05-E1 | two colleagues accept: first wins | unit + SQL | pass |
| F05-E2 | one live exchange per shift; only own shift | unit + SQL | pass |
| F05-E3 | approve_incoming skips the manager | unit + SQL | pass |
| F07-H1 | clock in/out, approve; one running clock | unit + SQL | pass |
| X-1 | a second organisation sees nothing in any table (RLS) | SQL | pass; mutation check proves it can fail |
| X-2 | other employees' data hidden (profile, timesheet, absence tab) | e2e | pass |
| X-3 | permission-denied pages (settings, employees, bezetting, rooster) | e2e | **BUG-2, fixed** |
| X-4 | expired/deactivated session goes to login | e2e | pass |
| X-5 | WCAG 2 A/AA scan, 12 pages x desktop+mobile, login, shift drawer | axe | pass |
| B-1 | Stripe webhook: tampered, wrong secret, missing, replayed; duplicates; 500 on DB error | server tests | pass |
| B-2 | email outbox: once, retry, dead-letter after 5 | SQL + server | pass |
| B-3 | jobs idempotent (accrual, publish, series, reminders) | SQL | pass |

## Not automated (manual pass needed)

- Real email delivery (Resend, domain DNS), real Stripe Checkout and Customer Portal with test card 4000 0000 0000 0002, real Supabase auth: no keys here.
- Slow network, offline: demo store has no network. Re-check when the live data layer exists.
- Screen reader pass with VoiceOver/NVDA (axe only catches what machines can). The schedule grid's drag and drop has no arrow-key alternative inside the grid, only the edit form.
- Visual check on a real phone.
