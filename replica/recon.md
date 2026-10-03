# Recon map: Shiftbase (web + employee mobile app)

Scope: core loop: rostering (schedule, shifts, open shifts, swaps), availability, absence. Time clock / timesheets are "should".
For: a niche product to sell (segment still to choose)
Date: 2026-10-03 (revision 3)

> **STATUS: MEDIUM CONFIDENCE.** Revision 2 reads the public help center
> (help.shiftbase.com, 30+ articles) instead of search snippets. Still NOT read:
> www.shiftbase.com (marketing, pricing; blocked by the network policy), the
> developer docs (Stoplight single-page app, renders empty without JS) and the
> app store listings. No screenshots exist yet: `replica/screens/` needs the user's own
> account or app store images. Tags: `[help]` = read in a help article, `[guess]` =
> inferred, `[search]` = from an earlier search snippet only. Never read: JS bundles, private
> API calls, anyone else's account.

## Sources

| # | source | URL | status |
| --- | --- | --- | --- |
| 1 | help center index | https://help.shiftbase.com/ | read: 14 categories |
| 2 | Schedule category | https://help.shiftbase.com/schedule | read |
| 3 | Adding, editing & deleting shifts | https://help.shiftbase.com/adding-editing-deleting-shifts | read |
| 4 | Open shifts | https://help.shiftbase.com/open-shifts | read |
| 5 | Exchange requests | https://help.shiftbase.com/exchange-requests | read |
| 6 | Specify availability | https://help.shiftbase.com/specify-availability | read |
| 7 | Availability rules | https://help.shiftbase.com/availability-rules | read |
| 8 | Publishing the schedule | https://help.shiftbase.com/publishing-the-schedule | read |
| 9 | Required shifts | https://help.shiftbase.com/setting-up-required-shifts | read |
| 10 | Managing shift types | https://help.shiftbase.com/managing-shifts-in-the-settings | read |
| 11 | Absence category + adding/editing absences | https://help.shiftbase.com/absence | read |
| 12 | Time off balances | https://help.shiftbase.com/managing-time-off-balances | read |
| 13 | Locations, departments & teams | https://help.shiftbase.com/managing-locations-departments | read |
| 14 | Permissions | https://help.shiftbase.com/permissions | read |
| 15 | Timesheet: adding/approving hours | https://help.shiftbase.com/adding-editing-and-approving-working-hours | read |
| 16 | Mobile app: schedule | https://help.shiftbase.com/mobile-app-schedule | read |
| 17 | Employees, Timesheet, Mobile app, Getting started categories | https://help.shiftbase.com/employees etc. | read (titles only) |
| 18 | public API docs | https://developer.shiftbase.com/ | NOT READABLE (Stoplight SPA); base https://api.shiftbase.com/api/ [search] |
| 19 | marketing, pricing | https://www.shiftbase.com/ | BLOCKED |
| 20 | app store listings, changelog | https://help.shiftbase.com/release-notes | TODO |

## Extra findings (revision 3)

Searched for pricing, API spec and app-store data; apps.apple.com, itunes, stoplight.io, getapp and apitracker are blocked, the Stoplight docs render empty. What was found:

- **Pricing** (third-party listings, via web search, unverified against shiftbase.com): free plan up to 75 employees and 1 department; Basic EUR 3.25, Premium EUR 4.25, Enterprise EUR 6 per user per month; 14-day trial [search]. Premium gates availability rules; Basic/Premium gate mobile open shifts [help]. Public API needs the paid "App Center Plus" add-on, 180 req/min, JSON [search, help].
- **Release notes** (help.shiftbase.com/release-notes, Jun-Sep 2026): the product is moving towards **auto-scheduling** (monthly, shift recommendations "Add" / "Add and assign", demand forecast, wage-aware cost), AI turnover forecast, payroll preparation flow, chat module, HR Pro e-signing, mobile app v6 redesign, light/dark theme. These are the direction of travel, not core loop: treat as "could", and a possible differentiator.
- **Still missing:** screenshots, API field lists, real UI states. Nothing more can be reached from this environment.

## Core loop

A planner builds a week per department/team from employees' availability and
absences, optionally against a "required shifts" staffing target, then
publishes it. Employees see it in the app, request swaps, claim open shifts,
set availability and request absence. [help]

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Log in / sign up / MFA | public | account access, optional MFA [help] | form | untested |
| S02 | Onboarding / quick start | after sign up | company, departments, invite staff | stepper | untested |
| S03 | Schedule (day / week / month) | main nav, Schedule tab | plan shifts per department/team | grid by team, shift card, open-shifts bar, required-shifts bar, filters (show availability, absences), Actions menu, publish dots [help] | untested |
| S04 | Shift form | "+ Add shift", "+" in grid, drag from Shifts/Teams panel | create/edit shift | date, repeat/ends, department, team, employee, shift template, times, unpaid/paid break, hide end time, description, send notification [help] | untested |
| S05 | Open shift detail | click open shift | invite, see requested, Assign | Employees tab with status labels [help] | untested |
| S06 | Publish dialog | Actions > Publish Schedule | toggle published days | blue/white day buttons, green/red dots, "Auto" label [help] | untested |
| S07 | Copy schedule / print / send | Actions menu | duplicate week, print, send, calendar sync | dialogs [help titles] | untested |
| S08 | Required shifts setup | Schedule settings | staffing targets | date/repeat, dept, team, instances, employees needed (min/max/exact), template [help] | untested |
| S09 | Exchange requests | schedule + notifications | manager approves/rejects swaps | list, status [help] | untested |
| S10 | Employees list | main nav | people, bulk actions, import | table, filters, bulk menu [help] | untested |
| S11 | Employee profile | from S10 | details, contracts, files/notes, skills, balances | tabs [help titles] | untested |
| S12 | Availability (employee + admin) | dashboard / app / planner | per-day available/unavailable entry | period picker, 4 day options, copy previous week [help] | untested |
| S13 | Absence overview + calendar | Absence nav | list requests, calendar of absences | pending hollow marker, filters [help] | untested |
| S14 | Absence form | "+ Add absence" | request/record | employee, type, period, hours/days, partial day, note, intermediate-shift handling [help] | untested |
| S15 | Timesheet | Timesheet nav | worked hours, approve, bulk approve | table, status pending/approved/declined [help] | untested |
| S16 | Settings: structure | Settings | locations, departments (variations), teams | forms [help] | untested |
| S17 | Settings: shift types | Settings > Schedule | templates | fields below [help] | untested |
| S18 | Settings: schedule, availability rules, publishing | Settings > Schedule | rules (deadline, reminder, days/week) [help] | forms | untested |
| S19 | Settings: absence types, policies, balances, restrictions | Settings > Absence | leave config [help titles] | forms | untested |
| S20 | Settings: permissions | Settings | groups, per-department assignment [help] | checkbox matrix | untested |
| S21 | Dashboard (employee) | home | next shifts, requests [help title] | cards | untested |
| S22 | Notifications | bell / email / push | publish, requests, decisions | list | untested |
| S23 | Mobile: My schedule / Team view / Open shifts / My absence / My availability / Employees | app tabs | employee self-service [help] | week list, 3-dot menu (exchange) | untested |
| S24 | Mobile: clock in/out, time registration | app | time clock (should) [help title] | button | untested |
| S25 | Integrations / API keys | Settings > App center | [search] | key list | untested |

## Flows

```
F01 Planner builds and publishes a week
    S03 -> S04 add shift (3 ways: button, +, drag) -> (repeat/copy week S07) -> S06 publish -> S22 staff notified
    publish rule: visible-days setting 365 = always published, N = rolling window, 0 = manual [help]
    edge: employee absent, marked unavailable (grey), overlapping shifts, recurring edit "only this / all future"
    happy path clicks: ~4 per shift (measure on real app)

F02 Employee requests absence
    S14 -> pending (hollow in S03) -> S22 planner notified -> approve/decline in S13 -> balance deducted on approve
    approval screen checks: restrictions, balance (blocks going negative unless permitted), overlap +-7 days, contract, intermediate shifts (remove/leave/make open)  [help]

F03 Employee sets availability
    S12 -> save -> S03 planner toggles "Show availability" (green / grey)
    no approval; deadline + reminder from rules (S18)  [help]
    edge: copy previous week, partial day "available from / unavailable from"

F04 Open shift
    planner creates open shift (needs N employees) -> invites -> employee requests/declines
    approval-required: Requested -> planner "Assign"; otherwise first come first served
    statuses: Not invited, Invited, Requested, Declined, Assigned  [help]

F05 Shift exchange
    employee "Request exchange" on own shift -> colleagues invited -> first accepts -> manager approves/rejects
    optional permission "Approve incoming exchange" lets employee approve a mutual swap  [help]

F06 Required shifts coverage
    S08 define target -> S03 bar shows scheduled / required counter  [help]

F07 Timesheet approval (should)
    S24 or S15 add hours -> pending -> approve / decline (single or bulk) -> day closed to edits  [help]
```

## Components

Week/day/month schedule grid grouped by team; shift card (colour by shift type, short name); open-shifts bar; required-shifts bar with x/y counter; drag-and-drop, copy and move icons; drawer/modal forms; date-range picker; status badges (pending hollow, approved, declined, published dot); filter bar with toggles (availability, absences); Actions menu; bulk-action menu; permission checkbox matrix; colour picker with hex; tabs; toasts; mobile bottom tabs with 3-dot item menu. Variants/states to be confirmed from screenshots.

## Inferred data model

```
Company        id, name, billing, settings, mfa_policy                  confidence: medium
Location       id, company_id, name, order                              high [help]
Department     id, location_id, name, order, public_holiday_group_id,
               address, variations (shift, permissions, availability,
               clocking, break, publishing, notification rules)         high [help]
Team           id, department_id, name, type (default|flexpool|hidden),
               colour, order                                            high [help]
Employee       id, user_id, company_id, contracts, skills, custom
               fields, files/notes, notification prefs                  medium
Contract       id, employee_id, type, start/end, hours/week, salary,
               rate_card_id, balance accrual per contract               medium [help]
PermissionGroup id, name, permissions[]; assigned per employee per
               department (Admin, Manager, Planner, Employee defaults)  high [help]
ShiftType      id, department_id, name, short_name, start, end,
               unpaid_break, paid_break, colour, hide_end_time, is_task,
               description, skills, rate_card_id, order, custom_fields  high [help]
Shift          id, department_id, team_id, shift_type_id,
               employee_id (null = open), date, start, end, breaks,
               hide_end_time, description, recurrence (rule, ends),
               needed_count (open shifts)                               high [help]
ShiftInvite    id, shift_id, employee_id,
               status (invited|requested|declined|assigned)             high [help]
RequiredShift  id, department_id, team_id, shift_type_id, date,
               recurrence, instances, needed (min|max|exact), time
               flexibility, breaks                                      high [help]
PublishState   department_id, date, published (plus auto window days)   medium [help]
Availability   id, employee_id, date, kind (all day|from|unavail
               all day|unavail from), time                              high [help]
AvailabilityRule department_id, edit_until, reminder_on,
               remind_days_before, min_days_per_week                    high [help]
AbsenceType    id, name, balance_id, paid                               medium
AbsenceBalance id, name, unit (hours|days), default_accrual,
               expiration, per-contract accrual; plus corrections       high [help]
Absence        id, employee_id, type_id, start, end, hours/days,
               partial_start, note, status (pending|approved|declined),
               decided_by, intermediate_shift_action                    high [help]
AbsenceRestriction department/type limits                               guess
ShiftExchange  id, shift_id, from_employee, to_employee,
               status (pending colleague|pending manager|approved|
               rejected)                                                high [help]
Timesheet entry id, employee_id, date, dept, team, shift_type, start,
               end, breaks, meals, mileage, notes, rate_card,
               status (pending|approved|declined)                       high [help]
PlusMinus      employee_id, balance, corrections                        medium [help title]
Notification   id, user_id, kind, payload, read_at, channel             guess
ApiKey         id, company_id, token_hash                               medium [search]
```

Relationships: Company 1-n Location 1-n Department 1-n Team. Employees move freely between teams of one department (loaning = change team). Employee n-n Department with a permission group per pair. Department 1-n ShiftType, Shift. Shift 0..1 Employee; open shift 1-n ShiftInvite. Employee 1-n Availability, Absence, Contract. Real field lists need the API docs.

## Feature matrix

See `features.csv` (rows re-prioritised from help-center evidence).

## Out of scope (cannot or should not be cloned)

- Integration marketplace and partner deals (payroll, POS, HR connectors); Cello referrals
- Brand, logo, copy, illustrations, fonts, weather data provider, Employee Sentiment Analyzer content
- Statutory rule packs per country (e.g. the Dutch Working Hours Act compliance check) beyond a generic configurable rule engine
- Customer data; hardware kiosk terminals; HR Pro add-on (contract e-signing) unless chosen later

## Size

Screens 25, flows 7, entities ~22. Hard parts: (1) the schedule grid (drag/drop, recurrence "only this vs all future", copy week, three views, per-department publish rolling window), (2) absence engine (balances in hours or days, accrual per contract, expiry, restriction and overlap checks, shift side-effects), (3) department variations plus per-department permissions, with time zones/DST and push/email notifications. Size: **L** for core loop (schedule, availability, absence, open shifts, swaps, basic mobile web); **XL** with timesheets, payroll, compliance and native apps. Rescope per niche segment.

## Next

1. Get www.shiftbase.com pages or the user's own screenshots into `replica/screens/` (pricing, plan gating, UI states).
2. Read `release-notes` and the API docs (user can export the OpenAPI spec from Stoplight).
3. Then `/replica-architect`.
