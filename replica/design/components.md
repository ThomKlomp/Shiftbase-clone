# Components

Tokens: `tokens.json` / `tokens.css` / `tailwind.tokens.js`. Roles only, no raw hex. Icons: Lucide (MIT). Font: Inter (OFL). All copy is written fresh. Screens are S-IDs from `recon.md`. Every interactive element: real HTML element, visible `focus-visible` (2px `focus-ring`, 2px offset), min target 44px on touch, respects `prefers-reduced-motion`.
Status is never colour alone: always an icon or label too.

## Layout

```
App shell
  parts     sidebar 232px (collapses to bottom tabs < md), header 56px, content max 1440
  states    sidebar collapsed, mobile drawer; org/department switcher in header
  a11y      <nav> landmarks, skip-to-content link, current page aria-current
  used on   all

Schedule grid  (the hard one)
  parts     name/team column 200px sticky left, day columns min 120px, header row sticky top,
            team group rows (collapsible, team colour dot), open-shifts row, required-shifts row
  views     day, week, month (month shows short names only)
  states    loading skeleton rows, empty team ("no employees yet" + add), filtered, week unpublished
  overlays  availability (avail-yes / avail-no cell tint, with hatching for unavailable so it is not colour only),
            absence blocks (hollow outline = pending, filled = approved)
  interact  click empty cell = add, drag shift to move, modifier-drag = copy, arrow keys move cell focus,
            Enter opens shift, Shift+arrows extends selection, Delete removes with confirm
  a11y      role=grid, row/column headers, each cell aria-label "Mon 4 Nov, Sam, early shift 09:00-17:00";
            drag always has a keyboard alternative (Move/Copy menu)
  used on   S03

Shift card
  variants  assigned, open (dashed border, "needs 2"), requested (user+ icon), task (no hours)
  size      min height 28px (week), 20px (month, short name only)
  tokens    bg shift-N, text shift-N-text, radius sm; dot colour never the only signal
  states    default, hover (shows edit/delete/copy actions), selected (2px accent ring), dragging (pop shadow, 80% opacity),
            conflict (warning icon + tooltip text), unpublished (dotted border)
  content   time range (hidden when hide_end_time -> start only), short name, break icon if breaks
  used on   S03, S23

Publish status dot
  states    published (check icon + "Published"), unpublished (dash icon + "Draft"), auto (clock icon)
  used on   S03 header, S06

Coverage bar (required shifts)
  content   "scheduled / required" counter per slot; under = warning, met = success, over = accent-soft
  a11y      text counter always present, role=status for updates
  used on   S03, S08
```

## Inputs

```
Button
  variants  primary (accent), secondary (surface + border), ghost, danger
  sizes     sm 32, md 40, lg 48 (touch default lg)
  states    default, hover, active, focus-visible, disabled (aria-disabled, explains why in tooltip), loading (spinner, label stays)
  tokens    radius md, font sm/600
  used on   all

Text input / textarea / select
  states    default, hover, focus (ring), filled, error (danger border + icon + message under), disabled, read-only
  tokens    border-input (3.58:1), radius md, height 40
  a11y      <label> always visible, error linked by aria-describedby, required marked in text not only *
  used on   S01, S04, S14, S16-S20

Time input
  behaviour 24h by default, locale-aware, accepts "9", "930", "0930"; end before start = overnight, shown with +1 day badge
  used on   S04, S17, S12

Date and date-range picker
  states    default, today, selected, range, disabled day (e.g. before contract), pending/approved absence marker, public holiday marker
  a11y      grid with arrow-key navigation, month/year announced, typed entry alternative
  used on   S03, S12, S14

Checkbox, radio, switch
  states    default, checked, indeterminate (checkbox), focus, disabled, error
  used on   S04 (repeat days, send notification), S20 permission matrix

Colour swatch picker
  options   the 8 shift colours + custom hex (contrast of chosen text colour auto-checked, fails = suggest darker text)
  used on   S17, S16 (team colour)

Employee picker (combobox)
  states    closed, open list, loading, empty ("no match"), multi-select chips
  rows      avatar initials, name, team, warning chip (on leave / unavailable / overlap)
  a11y      ARIA combobox pattern
  used on   S04, S05, S09
```

## Feedback and containers

```
Modal / drawer
  variants  modal (confirm), drawer right (forms; full screen < md), bottom sheet (mobile actions)
  states    default, loading, error summary at top, dirty-close confirm
  a11y      focus trap, Esc closes, returns focus to trigger, aria-modal, labelled title
  used on   S04, S05, S14, confirms

Scope dialog ("only this shift / this and following")
  content   radio choice, applies to recurring edit and delete; default = only this
  used on   S04

Status badge
  variants  pending (hollow + clock), approved (check), declined (x), invited, requested, declined, assigned, published, draft
  rule      icon + text + soft background; never colour only
  used on   S05, S09, S10, S13, S15

Toast
  variants  success, error, info, undo (delete shift, 6s)
  a11y      role=status (polite), error role=alert, never the only place an error appears
  used on   all

Banner (inline)
  variants  info, warning (conflicts, over balance), danger
  used on   S03, S14

Empty state
  parts     simple original line drawing, one sentence, one primary action
  needed    schedule with no shifts, no employees, no absences, no open shifts, no notifications, no search results
  used on   S03, S05, S10, S13, S22

Skeleton / loading
  rule      grid skeleton keeps final row/column sizes (no layout shift); >300ms before showing

Error states
  types     inline field, page-level (retry), 403 "you can't see this department", 404, offline banner
```

## Data display and navigation

```
Table
  parts     sticky header, sortable columns (aria-sort), row selection + bulk action bar, pagination 25/50/100
  states    loading, empty, filtered-empty, row hover, selected, error
  mobile    collapses to card list
  used on   S10, S13, S15, S25

Tabs
  states    default, selected, focus, disabled; arrow-key navigation
  used on   S11, S05

Filter bar
  controls  department select, team multi-select, date nav (prev/next/today), view toggle, toggle chips (availability, absences, drafts)
  used on   S03, S13, S15

Actions menu
  items     publish, copy week, print, send, calendar sync
  a11y      menu button pattern
  used on   S03

Avatar
  sizes     24, 32, 40; initials fallback; no images required
  used on   S03, S10, S23

Notification item
  states    unread (bold + dot), read; links to the relevant record
  used on   S22

Mobile bottom tabs
  items     My schedule, Team, Open shifts, Absence, More; badge for pending counts
  used on   S23

Skip link, breadcrumbs, pagination, tooltip
  tooltip   never holds essential info, also available on focus
```

## Not built from the original

Logo, icons, illustrations, wordmark, copy, brand colour and any of their screenshots. The accent is a placeholder until `/replica-brand`.
