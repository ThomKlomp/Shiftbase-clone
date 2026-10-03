# Build log

Stack: Next.js 15 + TypeScript + Tailwind (tokens from `replica/design`). Data layer is a fake in-browser store (`src/lib/api.ts`, same signatures the Supabase layer will implement). Dutch UI, all copy written fresh. Demo sign-in picks a person.

| ID | date | status | missing / harder than expected |
| --- | --- | --- | --- |
| S01 | 2026-10-03 | partial | demo person picker only; real sign up, MFA, reset in backend step |
| S02 | 2026-10-03 | not built | onboarding stepper; demo starts with seed data |
| S03 | 2026-10-03 | partial | week + day, drag move/copy, availability + absence overlay, coverage chips, conflict icons. No month view. Harder than expected: sticky headers + drag; keyboard alternative is the edit form, not arrow-key grid navigation yet |
| S04 | 2026-10-03 | done | repeat, scope dialog, conflicts as warnings, notify toggle |
| S05 | 2026-10-03 | done | invite / request / assign, both approval modes |
| S06 | 2026-10-03 | done | per-day publish dialog |
| S07 | 2026-10-03 | partial | copy week, print. No send-by-mail, no calendar feed |
| S08 | 2026-10-03 | partial | single-day rows only, no recurrence |
| S09 | 2026-10-03 | done | |
| S10 | 2026-10-03 | partial | add, search, deactivate. No CSV import, no bulk actions |
| S11 | 2026-10-03 | partial | profile with balance ledger + correction; no contracts/files |
| S12 | 2026-10-03 | done | copy previous week; no deadline/reminder rules |
| S13 | 2026-10-03 | partial | list with approve/decline/override. No absence calendar |
| S14 | 2026-10-03 | done | balance + nearby warnings, shift action. No partial-day start time UI |
| S15 | 2026-10-03 | partial | clock in/out, approve single/bulk. No manual entry, no close-days |
| S16-S19 | 2026-10-03 | partial | teams, publish window, open-shift approval, shift types, absence types. No locations CRUD, balances CRUD, policies |
| S20 | 2026-10-03 | partial | read-only permission matrix. Group editing not built |
| S21 | - | not built | employee dashboard |
| S22 | 2026-10-03 | done | in-app only |
| S23 | 2026-10-03 | done | responsive web (not a native app) |
| S24 | 2026-10-03 | done | via S15 page |
| S25 | - | not built | API keys |

Known gaps are also in `features.csv` (`clone` column). Screenshots for diff: `replica/clone-screens/` (1440 and 390).
