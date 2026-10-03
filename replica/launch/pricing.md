# Pricing (proposal, to be decided by the owner)

## Market, read 2026-10-03 (all via web-search summaries, not the vendors' own pages: verify before publishing)

| product | plans as summarised | source |
| --- | --- | --- |
| the original | free plan up to 75 employees and 1 department; Basic €3.25, Premium €4.25, Enterprise €6 per user per month; 14-day trial | third-party listings via search; shiftbase.com itself was not reachable. Their help centre confirms plan gating (availability rules: Premium; mobile open shifts: Basic/Premium) |
| Planday | Starter €2.49 (min. 5 users), Plus €4.49, Pro €6.49 per user per month | https://www.capterra.com/p/145648/Planday/ (via search, not opened) |
| Deputy | Lite $5.50, Core $7.25, Pro $10 per user per month; $30/month minimum on monthly billing | https://www.itqlick.com/compare/deputy/planday (via search, not opened) |

## What reviewers say about price and billing

Nothing verified: 0 reviews were readable (see `feedback.md`). No claim about billing complaints is made anywhere in the product or on the landing page.

## What the market tells us

A free plan up to 75 employees already exists at the original. **Undercutting on price is not a wedge**, and a thin free tier would look stingy next to it. Compete on fit for a chosen niche, trust (change log) and a clear bill.

## Model

Free plan + 14-day trial of the paid plan, per active employee per month, annual = 2 months free. Charge only for employees who are **active** (deactivated and invited-but-never-signed-in are free) and say so. Three tiers at most, named by who they are for:

| tier | for | price (proposal) | includes |
| --- | --- | --- | --- |
| **Klein** | a team of up to 15 in one department | free | schedule, publish, availability, absence with balances, open shifts, exchanges, change log |
| **Team** | growing teams, several departments | €3,00 per active employee per month, or €30 per active employee per year (12 months for the price of 10) | everything in Klein, no employee cap, multiple departments with their own rules, time clock and approval, print |
| **Organisatie** | multi-location companies | later: price on request | API keys, SSO, longer log retention. Not built yet, so not sold yet |

Rationale: €3,00 sits just under the original's Basic and Planday's middle plan while the free tier is smaller on purpose; the free plan exists to be tried, not to be the product. If the segment turns out to be price sensitive (care, cleaning), test €2,50.

## Billing promises that must be true in the product

- Cancel in one click in the Stripe Customer Portal (built: `/api/billing/portal`).
- Renewal reminder email 7 days before an annual renewal (not built yet: add a job).
- No surprise seat jump: the seat count shown at checkout is counted on the server (built); the invoice follows active employees monthly, with the count visible before it changes (not built).
- Prices include or exclude VAT clearly (decide, show "excl. btw" for B2B).

## Stripe objects to create (the owner does this, test mode first)

1. Product "Team": price `€3.00`, recurring monthly, per unit (licensed quantity) → set `STRIPE_PRICE_ID`.
2. Same product, price `€30.00` recurring yearly per unit (= 2 months free).
3. Customer Portal: allow cancel, allow update quantity off (seat count follows employees), allow payment method update, invoice history on.
4. Webhook endpoint `/api/webhooks/stripe` for `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
5. Tax: enable Stripe Tax if selling to EU consumers or across borders.
