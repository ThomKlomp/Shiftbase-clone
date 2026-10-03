# Recon map: Shiftbase (web, employee mobile app noted)

Scope: the core loop: rostering, availability, leave requests. Time clock is a "should".
For: a niche product to sell (segment still to choose)
Date: 2026-10-03

> **STATUS: DRAFT, LOW CONFIDENCE.** The session's network policy blocked
> shiftbase.com, help.shiftbase.com and developer.shiftbase.com, so nothing here
> was read from the pages themselves. Facts marked `[search]` come from web-search
> result summaries; everything marked `[guess]` is inferred from how workforce
> scheduling apps usually work. Re-run the recon once those hosts are reachable,
> or once the user supplies help-center text or screenshots from their own account.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | marketing site | https://www.shiftbase.com/ | NOT READ (blocked) |
| 2 | scheduling page | https://www.shiftbase.com/employee-scheduling | NOT READ (blocked) |
| 3 | pricing | https://www.shiftbase.com/pricing | NOT READ (blocked); search snippet says 14-day free trial, plans and add-ons |
| 4 | help: scheduling shifts | https://help.shiftbase.com/scheduling-shifts | NOT READ (blocked) |
| 5 | help: specify availability | https://help.shiftbase.com/specify-availability | NOT READ (blocked) |
| 6 | help: open shifts | https://help.shiftbase.com/open-shifts | NOT READ (blocked) |
| 7 | help: quick start (employees) | https://help.shiftbase.com/quick-start-guide-employees | NOT READ (blocked) |
| 8 | help: full API access | https://help.shiftbase.com/full-api-access | NOT READ (blocked) |
| 9 | public API docs | https://developer.shiftbase.com/ | NOT READ (blocked); snippet: base https://api.shiftbase.com/api/, JSON, 180 req/min, key via Settings > App center > Public API |
| 10 | integrations | https://www.shiftbase.com/marketplace | NOT READ (blocked) |
| 11 | app store listings | (not searched yet) | TODO |
| 12 | changelog | (not found yet) | TODO |

## Core loop

A manager builds and publishes a schedule per department from employees' availability and approved leave; employees see it in the app, swap shifts, update availability and request leave. [search]

## Screens

All rows are `[guess]` except where noted. IDs are stable once confirmed.

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Sign up / log in | public | create account, sign in | form, SSO buttons | untested |
| S02 | Onboarding | after sign up | company, departments, invite staff | stepper, forms | untested |
| S03 | Schedule (week view) | main nav | plan shifts per department/team [search: departments split into teams] | grid, shift card, day/week toggle, publish button | untested |
| S04 | Shift create/edit | from S03 | pick shift type, employee, time, break | modal/drawer | untested |
| S05 | Shift types | settings | define shift types per department [search] | table, colour picker | untested |
| S06 | Open shifts | from S03 | unassigned shifts staff can claim [search] | list, claim button | untested |
| S07 | Employees | main nav | people list, contract basics, invite | table, search, filters | untested |
| S08 | Employee profile | from S07 | details, teams, availability, leave balance | tabs | untested |
| S09 | Availability | employee/manager | employees specify when they can work [search] | weekly grid, recurring toggle | untested |
| S10 | Leave requests (manager) | main nav | approve, edit, reject requests [search] | list, filters, status badges | untested |
| S11 | Leave request (employee) | employee app/web | request leave, see balance [search] | date range picker, type select | untested |
| S12 | Shift swap | employee app | offer/accept swaps [search] | dialog, status | untested |
| S13 | My schedule (employee) | employee app | own upcoming shifts [search: staff view rotas] | list/calendar | untested |
| S14 | Notifications | bell / email / push | schedule published, request decided | list | untested |
| S15 | Settings: departments, teams, leave types | settings | structure the company | forms | untested |
| S16 | Integrations / API keys | settings > App center | public API keys [search] | key list | untested |

## Flows

```
F01 Manager builds and publishes a weekly schedule   [guess, parts search]
    S03 schedule -> S04 add shift -> (repeat) -> publish -> S14 staff notified
    happy path clicks: unknown (measure on the real app)
    edge: employee on leave, employee unavailable, overlapping shifts, overtime

F02 Employee requests leave   [search]
    S11 request -> S14 manager notified -> S10 manager approves/rejects -> S14 employee notified
    edge: insufficient balance, overlaps existing shift, partial days

F03 Employee sets availability   [search]
    S09 grid -> save -> reflected in S03 for the planner
    edge: recurring vs one-off, conflicts with already-published shifts

F04 Employee swaps a shift   [search]
    S13 -> S12 offer -> colleague accepts -> manager approval? (unknown)

F05 Employee claims an open shift   [search]
    S06 -> claim -> manager confirm? (unknown)
```

## Components

All `[guess]`: week grid, shift card, drawer/modal, date-range picker, status badge, toast, table with filters, tabs, avatar, colour-coded shift type chip, nav sidebar.

## Inferred data model

```
Company        id, name, timezone, settings                       confidence: guess
Department     id, company_id, name                               confidence: medium [search]
Team           id, department_id, name                            confidence: medium [search]
ShiftType      id, department_id, name, colour, default times     confidence: medium [search]
Employee       id, user_id, company_id, contract info, role       confidence: guess
Shift          id, department_id, team_id, shift_type_id,
               employee_id (null = open), start_at, end_at,
               break, published                                   confidence: medium (open shifts [search])
Availability   id, employee_id, weekday/date, from, to, kind      confidence: medium [search]
LeaveType      id, name, paid, counts_against_balance             confidence: guess ("holidays, sickness, special leave" [search])
LeaveRequest   id, employee_id, leave_type_id, start, end,
               status (pending|approved|rejected), decided_by     confidence: medium [search]
ShiftSwap      id, shift_id, from_employee, to_employee, status   confidence: guess
Notification   id, user_id, kind, payload, read_at                confidence: guess
ApiKey         id, company_id, token_hash                         confidence: medium [search]
```

Relationships: Company 1-n Department 1-n Team; Department 1-n ShiftType; Employee n-n Team; Shift n-1 Employee (nullable); Employee 1-n Availability, LeaveRequest.
Real field lists should come from the public API docs once reachable.

## Feature matrix

See `features.csv`. Rows are drafts; priorities are my guesses.

## Out of scope (cannot or should not be cloned)

- Shiftbase's integration marketplace and partner deals (payroll, POS, HR connectors)
- Their brand, logo, copy, illustrations, fonts
- Customer data and anything behind their login that is not the user's own account
- Hardware time clocks / terminals, if they exist

## Size

Screens 16 (draft), flows 5, entities ~12. Hard parts: schedule grid UX, overlap/conflict rules, time zones and DST, leave balance accrual, notifications and push. Size: **L** for the core loop (draft estimate, revisit after a real recon).
