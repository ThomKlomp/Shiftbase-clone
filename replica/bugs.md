# Bugs

Severity: S1 data loss/security/payments/core blocked, S2 feature broken no workaround, S3 broken with workaround or visibly wrong, S4 cosmetic.

| ID | sev | title | found by | status |
| --- | --- | --- | --- | --- |
| BUG-1 | S3 | Bezetting page scrolls sideways at 390px | F01-E4 | fixed |
| BUG-2 | S3 | Employees saw the settings, employees and bezetting UIs (writes were refused by the data layer, so no data exposure) | X-3 | fixed |
| BUG-3 | S2 | Two browser tabs overwrite each other's changes: the second save replaced the first (data loss in the demo store) | F01-E2 | fixed |
| BUG-4 | S4 | No favicon: every page load 404'd `/favicon.ico` | guard on every e2e test | fixed |

## BUG-1 Bezetting scrolls sideways on mobile
Steps: sign in as Bram, set viewport 390px, open `/vereiste-diensten`. Expected: no horizontal page scroll. Actual: the page was wider than the screen. Cause: a visually hidden header label (`sr-only`, absolutely positioned) escaped its scroll container. Fix: the container is `relative`, applied to the three tables that have such a label. Test: `edge.spec F01-E4`.

## BUG-2 Planner pages shown to employees
Steps: sign in as Chantal (employee), open `/instellingen`. Expected: a clear denial. Actual: the full settings UI. Fix: guards on settings, employees and bezetting pages. Test: `edge.spec N-3`. Note the real protection is in the data layer and in Postgres RLS (tested), not in the page.

## BUG-3 Lost update across tabs
Steps: open `/rooster` in two tabs as Bram, add a shift in each. Expected: both shifts exist. Actual: only the last saved. Cause: each tab held its own copy of the state and wrote it whole. Fix: every write first re-reads the stored state, and tabs listen to `storage` events. The first state is also saved at once so tabs start from the same data. Test: `edge.spec F01-E2`, `N-1`.

## BUG-4 Missing favicon
Fix: `src/app/icon.svg` (own artwork). Caught by the guard that fails any same-origin 4xx.

## To check (not reproduced)

- Drag and drop has no arrow-key alternative inside the grid itself; the form is the keyboard path. Needs a screen reader user to say if that is enough.
- The live Supabase data layer will bring the same lost-update risk: use `updated_at` checks on shift edits (listed in architecture.md).
