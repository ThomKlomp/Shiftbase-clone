# Launch plan

Honest starting point: a tested demo (in-browser data) with a backend that is verified against Postgres but not connected to live accounts (`backend.md`). The segment is not chosen. Nothing below should happen before items 1 and 2.

## Before any public launch

1. **Choose the niche** (care, hospitality, cleaning, retail...). Interview 5 people who plan rotas in that niche. Their words replace the provisional angle in `fixes.md`.
2. **Finish the live data layer and sign-in** (backend.md items 1 and 2). Until then the app is a demo.
3. **Collect real reviews** of the original and alternatives from a normal browser (`feedback.md`); redo the fix plan. Do not ship claims about competitors' weaknesses before that.
4. **Name, domain, trademark**: run the checks in `brand.md`, then a lawyer.
5. **Privacy policy and processors list** (Supabase, Vercel, Stripe, Resend, analytics). Data in the EU region.
6. **Billing in test mode** end to end with card `4000 0000 0000 0002` (decline) and a normal test card; the Customer Portal cancel path.

## Waitlist and beta

- A waitlist form needs a place to store emails: add it after the live data layer exists (a table plus a double opt-in mail). The landing page deliberately has none yet, so it does not collect data it cannot protect.
- Beta: 5 to 10 teams from the chosen niche, free, with a monthly call. Ask each for written permission before quoting them anywhere. Only then can the landing page show proof.

## Instrument

Error tracking (Sentry or similar) and privacy-friendly analytics (Plausible) live before beta; a status page; a support address that a human reads.

## Where to find people (to verify: no thread data was readable)

The original's unhappy users are not mapped. Candidate places to look, each to be checked by hand: Dutch Reddit communities for the chosen niche, niche Facebook groups, LinkedIn groups of team leads, trade associations' newsletters. Do not post fake reviews or sock-puppet comments (illegal in many places).

## Launch post

Lead with a fix, not with parity: "A rota tool where you can see who changed what" plus a 60-second screen recording. Product Hunt or a niche forum, whichever the chosen segment uses. Do not name the original in the post title.

## First 10 users

Talk to them by hand: watch them build one real week. Note every hesitation. The first 10 conversations decide the roadmap more than any feature list.

## Store listing

`listing.json` passes the linter (0 errors, 0 warnings) but there is no native app yet: ship the PWA first (installable, web push), and revisit stores later. Apple guideline 4.1 (copycats) will look at the screenshots: lead with the change log, conflict warnings and the phone planner. Required before submission: screenshots at the sizes current in App Store Connect and Play Console, privacy labels and data-safety form, privacy URL, support URL, age rating, demo account and review notes.
