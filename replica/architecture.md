# Architecture: workforce scheduling app (a rebuild of Shiftbase's core features)

Based on `replica/recon.md` rev 3 and `replica/features.csv`. Recon confidence is medium: field lists come from help articles, not the API docs. Expect schema tweaks once screenshots or the API spec exist.

## Stack

| layer | choice | why |
| --- | --- | --- |
| web | Next.js (App Router) + TypeScript, mobile-first responsive, installable as PWA | the schedule is a heavy interactive grid; one codebase also covers the employee "app" for v1 |
| styling | Tailwind with tokens from `/replica-design` | |
| mobile | PWA first, Expo later | native app is XL scope; push via web push meanwhile |
| database | Postgres on Supabase | RLS, auth, storage and cron in one managed product; `btree_gist` for contract exclusion |
| data access | `supabase-js` with generated types; server routes for privileged writes | no ORM, the SQL in `schema.sql` is the source of truth |
| auth | Supabase Auth (email + password, magic-link invites, TOTP MFA later) | invites map to `employees.user_id` |
| payments | Stripe Billing, per-seat subscription, free tier up to N employees | pricing decided in `/replica-launch` |
| email | Resend | publish, request and decision mails |
| jobs | Supabase pg_cron + Edge Functions (or Vercel Cron) | few, small, idempotent jobs |
| files | Supabase Storage | employee files, later |
| hosting | Vercel | |

One database, one deployable. No microservices.

## Schema

Tables: **24** (`replica/schema.sql`). Access rules: **RLS** for reads and the simple own-row writes; every other write goes through server routes using the service role after an explicit permission check (`has_perm`-equivalent in code). Tenant key is `org_id` on every table; permissions are per department via `employee_departments.permission_group_id`.

Key decisions:

- **Times:** `timestamptz` UTC for `start_at/end_at`, plus `work_date` (department-local date) on shifts. Publishing, availability, required shifts and reports key off local dates, so DST never moves a shift to another day. Department has its own `timezone`.
- **Open shifts:** a `shifts` row with `employee_id null` and `needed_count`. Assigning inserts a normal shift (`open_source_id` points back) and marks the invite `assigned`; the open row disappears when assigned count reaches `needed_count`.
- **Recurrence:** `shift_series` materialises concrete `shifts` rows (so "only this shift" edits stay trivial); a daily job extends open-ended series 90 days ahead. "All future" edits update rows with `series_id` and `work_date >= x`.
- **Publishing:** `published_days(department_id, day)`. Rolling auto-publish (`publish_days_ahead`, 0 = manual) is a daily job that inserts the newest day. Employees read shifts only on published days.
- **Balances:** append-only ledger `balance_entries` (accrual, usage, correction, expiry); balance = sum. Approving an absence inserts a `usage` row in the same transaction; declining or deleting an approved absence cascades it away.
- **Hard constraints in the database:** no overlapping contracts per employee (exclusion), one availability row per employee per day (unique), one live exchange per shift (partial unique), one running clock per employee (partial unique), one invite per employee per open shift (unique), end after start (checks).
- **Deliberately NOT constraints:** overlapping shifts, shifts on absence or unavailable days, negative balances. These are warnings in the UI (planners can override); negative balance is blocked in the approve route unless the caller has the override permission.

## API

Next.js route handlers (or server actions). `perm` = permission in the target department; "self" = own employee row.

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| POST /api/auth/invite | invite employee by email | employees.manage | email, dept+group | employee | F01 |
| GET /api/schedule | shifts, open shifts, required, availability, absences for range+dept | schedule.edit sees all; others published only | dept, from, to | grouped by team | F01 |
| POST /api/shifts | create shift (+ optional recurrence, notify) | schedule.edit | shift form | shift(s) | F01 |
| PATCH /api/shifts/:id | edit; `scope=this\|future` | schedule.edit | fields | shift(s) | F01 |
| DELETE /api/shifts/:id | delete; `scope`, notify | schedule.edit | | ok | F01 |
| POST /api/shifts/:id/move, /copy | move or copy to date/team/employee | schedule.edit | target | shift | F01 |
| POST /api/schedule/copy-week | duplicate week | schedule.edit | dept, from, to | count | F01 |
| PUT /api/schedule/publish | set published days | schedule.publish | dept, days[], notify | ok | F01 |
| GET /api/conflicts | overlaps, on-leave, unavailable for a draft shift | schedule.edit | shift | warnings[] | F01 |
| POST /api/open-shifts/:id/invite | invite employees | schedule.edit | employee ids | invites | F04 |
| POST /api/open-shifts/:id/respond | request or decline (auto-assign if dept needs no approval) | self | action | invite | F04 |
| POST /api/open-shifts/:id/assign | assign requested employee | schedule.edit | employee id | shift | F04 |
| GET/POST/PATCH /api/required-shifts | staffing targets | schedule.edit | form | rows | F06 |
| PUT /api/availability | upsert days for a period | self, or availability.edit_others | days[] | rows | F03 |
| GET/POST /api/absences | list; create (status forced pending, or approved by approver) | self / absence.approve | form | absence | F02 |
| POST /api/absences/:id/decide | approve or decline, run checks, write ledger, apply shift_action | absence.approve | decision, override | absence + warnings | F02 |
| GET /api/balances/:employee | ledger and totals | self / absence.approve | | balances | F02 |
| POST /api/balances/:employee/correct | manual correction | absence.approve | amount, note | entry | F02 |
| POST /api/exchanges | request exchange for own shift | self | shift id | exchange | F05 |
| POST /api/exchanges/:id/accept | colleague accepts (first wins; transactional) | self | | exchange | F05 |
| POST /api/exchanges/:id/decide | approve (reassign shift) or reject | exchange.approve; or exchange.approve_incoming for the accepting colleague | decision | exchange | F05 |
| GET/POST/PATCH /api/timesheet | entries; clock in/out; approve (single, bulk) | self / timesheet.approve | | rows | F07 |
| CRUD /api/settings/* | locations, departments, teams, shift types, absence types and balances, permission groups | settings.manage | | rows | |
| GET /api/notifications, POST /api/notifications/read | in-app list | self | | rows | |
| /api/public/v1/* | optional public API, API-key auth, 180 req/min | key | | JSON | later |

Webhooks in: Stripe (`checkout.session.completed`, `invoice.*`, `customer.subscription.*`), Resend delivery events. Webhooks out: none in v1.

Jobs:

| job | schedule | does |
| --- | --- | --- |
| auto_publish | daily 00:05 per department timezone | insert newest published day for rolling window |
| extend_series | daily | generate recurring shifts 90 days ahead |
| availability_reminder | daily 12:00 local | notify employees below `avail_min_days_per_week` per department rule |
| send_notifications | every minute | send emails for `notifications` where `emailed_at is null`, batched, idempotent |
| accrual | monthly | write `accrual` ledger entries per contract and balance |
| expire_balances | daily | write `expiry` entries |

## The parts that bite

- **Time zones and DST:** store UTC instants plus the department-local `work_date`. Build shift times from local date + local time + department zone, never by adding 24h. Test the spring and autumn change nights; a night shift crosses midnight and belongs to its start date.
- **Idempotency:** Stripe webhooks arrive twice (store event ids); notification sender marks `emailed_at` inside the claim transaction; publish and series generation use upserts.
- **Races:** two colleagues accepting one exchange, two employees taking the last open slot, planner and employee editing the same shift. Use `select ... for update` or conditional updates (`where status = 'pending_colleague'`) and return 409 on loss. Consider `updated_at` checks for concurrent shift edits.
- **Absence approval side effects:** one transaction: validate, write ledger row, update status, apply `shift_action` (leave / remove / make open), create notifications. Overlap check ±7 days is a warning.
- **Schedule grid performance:** query by `(department_id, work_date)` for one week; month view needs aggregates, not full cards. Virtualise rows for large teams.
- **Permissions:** per department, with a user able to be Planner in one and Employee in another. Every route checks the department of the target row, not the user's global role. Never trust `org_id` from the client.
- **Multi-tenancy:** RLS plus server checks; test that org A can never read org B (automated cross-tenant test per table).
- **Notifications:** respect "send notification" toggle per action; email deliverability (SPF/DKIM via Resend), unsubscribe for non-critical mails.
- **GDPR:** employee deletion/anonymisation keeps shifts and ledger but nulls name and email; export endpoint for own data.
- **Offline / realtime:** out of scope for v1; refetch on focus. Realtime schedule updates via Supabase Realtime later.
- **Rate limits:** per-key limit on the public API; per-user limit on invite and notification endpoints.

## Build order

1. **Vertical slice** (ugly, proves the stack): sign up + create org/department/team (S01, S02, S16) -> shift types (S17) -> week grid with create/edit/delete shift (S03, S04) -> invite one employee -> employee sees own shifts (S23 as responsive page). Tables: organizations, locations, departments, teams, employees, employee_departments, permission_groups, shift_types, shifts. Routes: auth, schedule GET, shifts CRUD, invite.
2. **Must-haves** (in this order):
   1. Publishing + notifications: `published_days`, `notifications`, S06, S22, jobs auto_publish and send_notifications. Plus recurrence, move/copy, copy week.
   2. Availability: S12 and the planner overlay in S03. Table `availability`.
   3. Absence: S14, S13, S19; tables absence_types, absence_balances, balance_entries, absences, contracts; routes absences, decide, balances; planner sees absences in S03.
   4. Open shifts: S05, invites and statuses, mobile list.
   5. Employees and permissions: S10, S11, S20; invite flow hardening, deactivate, import CSV.
   6. Mobile web polish for employees: my schedule, team view, open shifts, availability, absence (S21, S23).
3. **Should-haves:** required shifts and coverage bar (S08), exchanges (S09), conflict warnings (`/api/conflicts`), absence calendar, department variations, print/send/calendar sync (ICS feed), timesheet and clock (S15, S24), notification settings.
4. **Could-haves:** auto-scheduling (candidate differentiator: greedy fill of required shifts using availability, absences, contract hours), payroll prep, reports, compliance rules, public API, chat, MFA, native app.
5. **Fixes from replica-entrepreneur:** after it runs.

Billing (Stripe) lands after milestone 2.2, before a public launch.
