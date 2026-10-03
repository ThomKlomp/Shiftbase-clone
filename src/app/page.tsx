import Link from 'next/link';
import { BRAND } from '@/lib/brand';

const STEPS = [
  ['Zet je team klaar', 'Maak afdelingen, teams en dienstsjablonen aan. Voeg je medewerkers toe.'],
  ['Plan de week en publiceer', 'Sleep of tik diensten in het rooster. Publiceer per dag, dan pas zien je medewerkers het.'],
  ['Je team doet de rest', 'Medewerkers geven beschikbaarheid door, vragen verlof aan, nemen open diensten en ruilen. Jij keurt goed.'],
] as const;

const DIFFERENT = [
  ['Een logboek van alles', 'Zie wie een dienst heeft toegevoegd, gewijzigd of verwijderd, en wie verlof of een ruil heeft beoordeeld.'],
  ['Waarschuwen, niet blokkeren', 'Overlap, verlof of onbeschikbaarheid? Je ziet het direct, en je beslist zelf.'],
  ['Plannen op je telefoon', 'Het hele rooster is te bewerken op een klein scherm, met een dagweergave die past.'],
  ['Vergeten uitklokken? Zo gevonden', 'Een klok die te lang doorloopt wordt gemarkeerd. Herstellen is één tik.'],
  ['Een nette afdruk', 'Eén liggende pagina per week, zonder menu\'s en knoppen.'],
] as const;

const FAQ = [
  ['Kan ik mijn medewerkers importeren?', 'Een CSV-import komt nog. Nu voeg je medewerkers één voor één toe.'],
  ['Werkt het op mijn telefoon?', 'Ja, in de browser. Een eigen app volgt later.'],
  ['Waar staat mijn data?', 'In de demo nergens behalve in jouw browser. Bij de lancering lees je hier waar de data staat en welke partijen meekijken.'],
  ['Kan ik opzeggen?', 'Ja, met één klik in je account. Geen belletje, geen mail.'],
] as const;

export default function Landing() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <header className="flex items-center justify-between py-4">
        <span className="text-lg font-bold">{BRAND.name}</span>
        <Link href="/login" className="rounded-md px-3 py-2 font-semibold text-accent hover:bg-accent-soft">Demo openen</Link>
      </header>

      <main id="inhoud">
        <section className="grid items-center gap-8 py-10 md:grid-cols-2" aria-labelledby="hero">
          <div className="flex flex-col gap-4">
            <h1 id="hero" className="text-display font-bold" style={{ fontSize: 'clamp(28px, 5vw, 40px)', lineHeight: 1.1 }}>Het rooster van je team, ook vanaf je telefoon.</h1>
            <p className="text-base text-text-muted">Plan diensten, verzamel beschikbaarheid, regel verlof en ruilen op één plek. En zie altijd wie wat heeft aangepast.</p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/login" className="inline-flex h-12 items-center rounded-md bg-accent px-5 text-base font-semibold text-on-accent hover:opacity-90">Probeer de demo</Link>
              <span className="text-sm text-text-muted">Accounts volgen binnenkort. De demo draait met voorbeeldgegevens in je browser.</span>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/screens/rooster.png" width={1440} height={900} alt="Het weekrooster met diensten per medewerker, open diensten bovenaan en een tekortmelding per team" className="rounded-lg border border-border shadow-card" />
        </section>

        <section className="py-10" aria-labelledby="vraag">
          <h2 id="vraag" className="mb-3 text-xl font-bold">Vragen die je kent</h2>
          <ul className="grid gap-3 text-lg md:grid-cols-3">
            <li className="rounded-lg bg-surface p-4">“Wie heeft dit rooster eigenlijk aangepast?”</li>
            <li className="rounded-lg bg-surface p-4">“Staat Daan nu twee keer ingepland?”</li>
            <li className="rounded-lg bg-surface p-4">“Kan ik dit even op mijn telefoon rechtzetten?”</li>
          </ul>
        </section>

        <section className="py-10" aria-labelledby="hoe">
          <h2 id="hoe" className="mb-4 text-xl font-bold">Zo werkt het</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="rounded-lg border border-border p-4">
                <span className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-pill bg-accent text-on-accent font-bold" aria-hidden>{i + 1}</span>
                <h3 className="font-semibold">{t}</h3>
                <p className="text-text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="py-10" aria-labelledby="anders">
          <h2 id="anders" className="mb-4 text-xl font-bold">Wat het anders doet</h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {DIFFERENT.map(([t, d]) => (
              <li key={t} className="rounded-lg border border-border p-4"><h3 className="font-semibold">{t}</h3><p className="text-text-muted">{d}</p></li>
            ))}
          </ul>
          <p className="mt-4 text-text-muted">Natuurlijk ook: open diensten, verlofsaldo in uren, ruilverzoeken met goedkeuring en tijdregistratie.</p>
        </section>

        <section className="py-10" aria-labelledby="prijs">
          <h2 id="prijs" className="mb-1 text-xl font-bold">Prijs</h2>
          <p className="mb-4 text-text-muted">Tijdens de bèta is alles gratis. Daarna:</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border p-4"><h3 className="font-semibold">Klein</h3><p className="text-2xl font-bold">Gratis</p><p className="text-text-muted">Voor een team tot 15 mensen in één afdeling. Rooster, verlof, ruilen, open diensten en logboek.</p></div>
            <div className="rounded-lg border-2 border-accent p-4"><h3 className="font-semibold">Team</h3><p className="text-2xl font-bold">€3,00 <span className="text-base font-normal text-text-muted">per actieve medewerker per maand, excl. btw</span></p><p className="text-text-muted">Meerdere afdelingen, geen limiet, tijdregistratie. Jaarlijks betalen: 2 maanden gratis. Je betaalt alleen voor medewerkers die actief zijn. Opzeggen met één klik.</p></div>
          </div>
        </section>

        <section className="py-10" aria-labelledby="faq">
          <h2 id="faq" className="mb-4 text-xl font-bold">Veelgestelde vragen</h2>
          <dl className="flex flex-col gap-4">
            {FAQ.map(([q, a]) => (<div key={q}><dt className="font-semibold">{q}</dt><dd className="text-text-muted">{a}</dd></div>))}
          </dl>
        </section>

        <section className="rounded-lg bg-accent-soft p-8 text-center" aria-labelledby="slot">
          <h2 id="slot" className="mb-2 text-xl font-bold">Probeer het met voorbeeldgegevens</h2>
          <p className="mb-4 text-text-muted">Je hoeft niets in te vullen.</p>
          <Link href="/login" className="inline-flex h-12 items-center rounded-md bg-accent px-5 text-base font-semibold text-on-accent hover:opacity-90">Probeer de demo</Link>
        </section>
      </main>
    </div>
  );
}
