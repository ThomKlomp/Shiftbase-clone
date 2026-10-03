# Landing page copy (built at `/`, source in `src/app/page.tsx`)

Voice: helder, rustig, collegiaal (`brand.md`). No testimonials, user counts, ratings or "trusted by": none exist. The product is a demo today, so the page says so.

1. **Hero**: "Het rooster van je team, ook vanaf je telefoon." / "Plan diensten, verzamel beschikbaarheid, regel verlof en ruilen op één plek. En zie altijd wie wat heeft aangepast." Button: "Probeer de demo". Second line under it: "Accounts volgen binnenkort. De demo draait met voorbeeldgegevens in je browser." Screenshot: the real week schedule.
2. **De vraag die je kent**: "Wie heeft dit rooster eigenlijk aangepast?" and "Staat Daan nu twee keer ingepland?" Written as questions, not as claims about other products.
3. **Hoe het werkt**: 1. zet je teams en dienstsjablonen klaar, 2. plan de week en publiceer per dag, 3. je team geeft beschikbaarheid door, vraagt verlof en ruilt zelf, jij keurt goed.
4. **Wat het anders doet** (the fixes first): logboek, waarschuwing in plaats van blokkade bij overlap, plannen op je telefoon, vergeten uitklokken vinden en herstellen, nette afdruk. Then the basics as one line: open diensten, verlofsaldo, ruilen, tijdregistratie.
5. **Prijs**: from `pricing.md`; "Tijdens de bèta is alles gratis" until billing is switched on.
6. **Veelgestelde vragen**: Kan ik mijn medewerkers importeren? (CSV-import volgt; nu handmatig.) Werkt het op mijn telefoon? (Ja, in de browser; een app volgt later.) Waar staat mijn data? (Nog niets: de demo bewaart alles lokaal in je browser. Bij de lancering: EU-regio, zie privacyverklaring.) Kan ik opzeggen? (Met één klik.)
7. **Slot**: "Probeer het met voorbeeldgegevens. Je hoeft niets in te vullen."

Contrast: page uses only token colours; checked with the tokens contrast script (0 failures) and axe in `tests/e2e/a11y.spec.ts`.
