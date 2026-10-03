# Parity report (2026-10-03)

**Verdict: not shippable.** 6 of 18 must-haves are only partial, and no real auth or live data layer exists yet (see `backend.md`). No open S1 or S2 bugs (`bugs.md`).

| measure | score |
| --- | --- |
| feature parity (weighted must 3, should 2, could 1, partial = half) | 59.9 |
| layout per screen | not measured: there are no screenshots of the original in `replica/screens/` (the recon sources were help articles only). Clone screens for later diffing are in `replica/clone-screens/` |
| tests | 70 unit/DB/server + 67 browser tests passing, axe WCAG A/AA clean on 12 pages x 2 widths |

Honest reading: the core loop (roster, publish, availability, absence with balances, open shifts, exchanges, clock) works end to end in demo mode and is tested, including the permission model and tenant isolation in Postgres. The score is held down by the long tail of `could` rows (payroll, reports, forecast, chat, kiosk, theme: all 0) and by the partial must-haves below.

## Behaviour differences (from the help articles; to re-check against the user's own account)

| flow | original does | clone does | fix or keep |
| --- | --- | --- | --- |
| F01 add shift | three ways: button, "+" in grid, drag from a Shifts/Teams panel | button, "+" on hover/focus, drag to move. No Shifts/Teams side panel | keep for now; panel is a speed feature, add later |
| F01 publish | per-day dialog, rolling window (365 / N / 0) | same, plus the dialog also unpublishes. Window default in demo is 0, in DB 365 | keep; make the default explicit at onboarding |
| F01 views | day, week, month | day, week | **build month** |
| F02 absence approval | checks restrictions, balance, +-7 day overlap, contract, active contract | balance and +-7 day overlap, shift action. No restrictions, no contract check | build restrictions after launch |
| F02 balances | hours or days, statutory/non-statutory expiry, migrations | hours only, ledger, corrections, accrual job (SQL) | keep; expiry is a `could` |
| F03 availability | no approval, reminder and deadline rules (Premium) | no approval; reminder job exists in SQL, deadline not enforced | enforce deadline later |
| F04 open shifts | approval optional per setting, statuses incl. "Not invited" | same two modes and statuses; invite all eligible in one click | keep |
| F05 exchange | colleague first-come, manager approval, optional self-approval permission | same | keep |
| F07 time | punch clock, kiosk, break rules, clock boundaries, open/close days | punch clock, approve single/bulk. No manual entry, kiosk, boundaries | `should`: build manual entry next |
| mobile | native iOS/Android app, widgets, push | responsive web, in-app notifications | keep: PWA + web push before native |
| clicks to add one shift | not measured (no account) | 4: open form, pick employee, set times (template fills them), save | re-measure vs original |

## Top five to build next

1. **Live data layer + auth + email** (turns 4 partial must-haves into done: sign up, notify on change, rolling publish, invites). Needs the owner's Supabase/Resend keys.
2. **Month view** of the schedule (must).
3. **Locations as real records** and a department/team settings UI that can rename and reorder (must).
4. **Employee CSV import** (must, the first thing a customer with 30 staff needs).
5. **Absence calendar** and **employee dashboard** (should, cheap, high perceived value).

## Feature parity: 59.9 / 100

features 59.9  (46 counted, must-haves 12 of 18 done)

Not shippable yet: 6 must-have features are not done.

## By area, weakest first
- performance                    0.0  (1 features)
- reports                        0.0  (1 features)
- integrations                   0.0  (1 features)
- payroll                        0.0  (1 features)
- communication                  0.0  (1 features)
- ux                             0.0  (1 features)
- people                        25.0  (4 features)
- notifications                 30.0  (2 features)
- onboarding                    37.5  (2 features)
- structure                     50.0  (2 features)
- time clock                    50.0  (3 features)
- absence                       68.2  (5 features)
- schedule                      70.0  (14 features)
- employee app                  80.0  (4 features)
- availability                  85.7  (3 features)
- permissions                  100.0  (1 features)

## Missing, in build order
- [must] notifications: Notify employees on shift change, partial  (in-app; email in backend)
- [must] onboarding: Sign up and log in, partial  (demo sign-in; real auth in replica-backend)
- [must] people: Employee management invite deactivate import, partial  (add, deactivate; no CSV import, no real invite mail)
- [must] schedule: Day / week / month schedule grid by team, partial  (week + day; month view not built)
- [must] schedule: Publish schedule per day with rolling auto-publish, partial  (window setting + manual; daily job in backend)
- [must] structure: Locations / departments / teams hierarchy, partial  (departments+teams; location is a label)
- [should] absence: Absence calendar, no  (list view only; planner sees absences in grid)
- [should] employee app: Employee dashboard, no
- [should] notifications: Push and email notification settings, no
- [should] absence: Time off balances (hours or days) with accrual, partial  (hours ledger; accrual job in backend)
- [should] schedule: Print / send schedule / calendar sync, partial  (print only)
- [should] schedule: Required shifts (staffing targets and coverage bar), partial  (single-day rows; no recurrence)
- [should] structure: Department variations (own rules per department), partial  (publish window and open-shift approval only)
- [should] time clock: Timesheet add and approve hours, partial  (clock + approve; no manual entry)
- [could] availability: Availability rules (deadline reminder min days), no  (needs jobs)
- [could] communication: Chat module, no
- [could] integrations: Public API with API keys, no  (verify scope)
- [could] onboarding: Multi-factor authentication, no  (help: securing account with MFA)
- [could] payroll: Payroll preparation flow, no  (Basic plan; defer)
- [could] people: Bulk actions on employees, no
- [could] people: Contracts and surcharges / rate cards, no  (payroll-ish; defer)
- [could] people: News and company files, no
- [could] performance: Budget and forecast, no
- [could] reports: Reports, no
- [could] schedule: Auto-scheduling (draft schedule from availability and required shifts), no  (2026 release notes; differentiator candidate)
- [could] schedule: Compliance check (working hours law), no  (country rule packs; generic rules only)
- [could] schedule: Shift recommendations for required shifts, no  (add / add and assign)
- [could] schedule: Skills on shifts, no
- [could] time clock: Kiosk mode, no
- [could] ux: Light / dark / system theme, no
- [could] absence: Balance expiry and corrections, partial  (corrections only)

## Left out on purpose (not scored)
- Integration marketplace (payroll POS HR): partner network cannot be rebuilt
- HR Pro (contracts e-signing onboarding): add-on; out of scope for now
- Weather forecast and sentiment analyzer: licensed/third-party data
- Demand forecast and AI turnover forecast: needs historic data; defer

