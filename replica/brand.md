# Brand

Status: **working name, not cleared.** Naming is the owner's decision and a trademark lawyer's check. Nothing here is legal clearance.

## Name

Angle (from `fixes.md`, provisional): a rota tool for a chosen niche, with a change log for trust. The name should be Dutch-friendly, short, and say "turns / shifts of work" without echoing the original.

Dropped on sight: anything with "shift" or "base" (too close to the original), "-ly" twins, and "Rooster…" names: the Dutch market is full of them (search 2026-10-03 found Roosterplaats, Roosterplan, MyRooster, TopRooster, MijnShift, Bedrijfsrooster). The previous placeholder "Rooster" is a plain noun and crowded, so it cannot be the brand.

| candidate | style | note |
| --- | --- | --- |
| **Beurtwerk** (recommended) | compound, Dutch ("beurt" = turn, "werk" = work) | one search for "Beurtwerk" + roster software 2026-10-03: no product by that name in the first 10 results (not a clearance) |
| Wisselwacht | compound ("wissel" = change/swap, "wacht" = watch/shift) | same search: no hits; slightly long, "wacht" suggests security/care, good for a care niche |
| Ploegplan | descriptive | a common Dutch term (ploegendienst, also sport tactics): weak as a mark, hard to own |
| Kwartier | metaphor | short, but unrelated to rotas; unclear meaning |
| Roosterwerk | descriptive | crowded "Rooster" family: rejected |

### Checks (state each as run or to run)

| check | Beurtwerk | Wisselwacht |
| --- | --- | --- |
| web search "name + category" | run 2026-10-03: nothing found | run 2026-10-03: nothing found |
| BOIP / Benelux trademark register (boip.int) | **to run** | **to run** |
| EU trademark (EUIPO eSearch / TMview) | **to run** | **to run** |
| US trademark (tmsearch.uspto.gov, classes 9, 42) | **to run** | **to run** |
| WIPO Global Brand Database | **to run** | **to run** |
| domains (.nl, .com, .app) | **to run**: no WHOIS tool here; a DNS lookup returned nothing but is not proof | **to run** |
| App Store / Google Play name search | **to run** (stores blocked here) | **to run** |
| handles (X, Instagram, TikTok, GitHub, LinkedIn) | **to run** | **to run** |

Before paying for a domain or logo: a trademark lawyer's proper search in the Benelux and EU.

## Palette

Deep teal accent `#0f766e` (was a placeholder blue). The original's brand colour was never recorded during recon (no screenshots), so `brand.json` `colors` is empty: the sweep cannot catch it by value. Use the owner's own account to check that no screen shares the original's signature colour pair.

| role | value | note |
| --- | --- | --- |
| accent | `#0f766e` | 5.47:1 on white |
| accent-soft | `#dcf2ee` | backgrounds, selected rows |
| on-accent | `#ffffff` | 5.47:1 on accent |
| focus-ring | `#0f766e` | 5.47:1 on white (needs 3) |

Contrast check: `python3 .claude/skills/replica-design/contrast.py replica/design/tokens.json` → 27 pairs, 0 failing AA. The eight shift colours are functional (they tell shift types apart) and stay.

## Logo brief

- Idea: turns that interlock. Two or three stacked bars of different lengths (a rota seen from the side) forming a "B", or a single bar with a small step in it.
- Type: symbol plus wordmark. Wordmark in a friendly geometric sans, lower case "beurtwerk".
- Must hold up at 16px (favicon: bars only, no text) and as a 1024px app icon.
- Deliverables: SVG master (one colour and reversed), app icon 1024x1024 with no transparency (iOS), favicon set (SVG, 32, 180 touch), social image 1200x630.
- Must not resemble the original's mark: no shared shape, colour pair or letterform trick. Put their logo next to every draft before choosing. (The current `src/app/icon.svg` is a placeholder of three bars on the accent colour, drawn here, not a final logo.)

## Voice

Three words:

- **Helder** (clear): says what will happen. Not blunt: no jargon, but also no cold orders.
- **Rustig** (calm): even when something is wrong. Not sleepy: still points to the next step.
- **Collegiaal** (like a colleague): "je", never "u", plain words. Not jokey: no emoji in errors, no exclamation marks.

| do | don't |
| --- | --- |
| "Je hebt geen rechten om de instellingen te beheren." | "Toegang geweigerd." |
| "Saldo te laag: 12 beschikbaar, 40 gevraagd" | "Fout: onvoldoende saldo!" |
| "Er is al een ruilverzoek voor deze dienst." | "Kan niet. Er loopt al een ruil." |
| "Nog niets gepubliceerd. Zodra je planner het rooster publiceert, zie je hier je diensten." | "Geen data." |
| "Je kunt de dienst toch opslaan." | "Waarschuwing negeren?" |

The ten most-seen strings were written fresh for this product in Dutch (none taken from the original): sign-in heading and demo note, schedule title and hint, "Dienst toevoegen", the save/confirm toasts ("Dienst toegevoegd", "Dienst opgeslagen"), the conflict banner, empty states (schedule, open shifts, notifications), the publish dialog, the absence form errors, and the email subjects (`src/lib/server/email.ts`). They already follow the voice. Re-read them once with a native speaker.

## Sweep

`python3 .claude/skills/replica-brand/sweep.py . --config replica/brand.json` → clean (names, domains). By-eye checks still open: favicon (placeholder), page titles (now from `src/lib/brand.ts`), email templates (use the name only through `BRAND`), the Open Graph image (does not exist yet), app icon (none yet).
