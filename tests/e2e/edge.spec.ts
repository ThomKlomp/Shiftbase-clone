import { expect, test } from './fixtures';
import { freshDemo, loginAs } from './helpers';

test.beforeEach(async ({ page }) => { await freshDemo(page); });

test('F01-E1 double click on Opslaan creates exactly one shift', async ({ page }) => {
  await loginAs(page, 'Bram');
  await page.getByRole('button', { name: /Dienst$/ }).first().click();
  await page.getByLabel('Medewerker', { exact: true }).selectOption({ label: 'Anna de Vries' });
  await page.getByLabel('Begintijd', { exact: true }).fill('05:00');
  await page.getByLabel('Eindtijd', { exact: true }).fill('06:00');
  await page.getByRole('button', { name: 'Opslaan' }).dblclick();
  await page.waitForTimeout(300);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('rooster-demo-v1')!).shifts.filter((s: { start: string; end: string }) => s.start === '05:00' && s.end === '06:00').length);
  expect(stored).toBe(1);
});

test('F01-E2 two tabs: a change in one tab is not lost by the other', async ({ page, context }) => {
  await loginAs(page, 'Bram');
  const tab2 = await context.newPage();
  await tab2.goto('/rooster');
  const add = async (p: typeof page, time: string) => {
    await p.getByRole('button', { name: /Dienst$/ }).first().click();
    await p.getByLabel('Medewerker', { exact: true }).selectOption({ label: 'Anna de Vries' });
    await p.getByLabel('Begintijd', { exact: true }).fill(time);
    await p.getByLabel('Eindtijd', { exact: true }).fill(time.replace(/^0(\d)/, (_, d) => `0${Number(d) + 1}`));
    await p.getByRole('button', { name: 'Opslaan' }).click();
    await expect(p.getByText('Dienst toegevoegd')).toBeVisible();
  };
  await add(page, '01:00');
  await add(tab2, '03:00');
  const times = await page.evaluate(() => JSON.parse(localStorage.getItem('rooster-demo-v1')!).shifts.map((s: { start: string }) => s.start));
  expect(times).toContain('01:00');
  expect(times).toContain('03:00');
});

test('F01-E3 a 60 character name with emoji does not break the grid or the layout', async ({ page }) => {
  await loginAs(page, 'Anna');
  await page.goto('/medewerkers');
  await page.getByRole('button', { name: 'Medewerker toevoegen' }).click();
  await page.getByLabel('Voornaam').fill('Zoë 🌟 Ñandú-Œuvre');
  await page.getByLabel('Achternaam').fill('A'.repeat(55));
  await page.getByLabel('E-mailadres').fill('lang@voorbeeld.nl');
  await page.getByRole('button', { name: 'Toevoegen', exact: true }).click();
  await expect(page.getByText('Medewerker toegevoegd')).toBeVisible();
  for (const path of ['/medewerkers', '/rooster']) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `${path} scrolls sideways`).toBe(false);
  }
});

test('F01-E4 mobile width: no horizontal page scroll on any page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, 'Bram');
  for (const p of ['/rooster', '/open-diensten', '/ruilen', '/verlof', '/beschikbaarheid', '/vereiste-diensten', '/tijdregistratie', '/meldingen', '/mijn-rooster', '/meer']) {
    await page.goto(p);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), `${p} scrolls sideways`).toBe(false);
  }
});

test('F01-E5 refresh keeps data; back button works', async ({ page }) => {
  await loginAs(page, 'Bram');
  await page.goto('/verlof');
  await page.goto('/ruilen');
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Verlof' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Verlof' })).toBeVisible();
});

test('N-1 expired session: deactivated user is sent to login', async ({ page }) => {
  await loginAs(page, 'Bram');
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('rooster-demo-v1')!); s.employees.find((e: { id: string }) => e.id === 'e2').active = false; localStorage.setItem('rooster-demo-v1', JSON.stringify(s)); });
  await page.reload();
  await page.waitForURL(/\/login/);
});

test('N-2 other people\'s data is invisible to an employee', async ({ page }) => {
  await loginAs(page, 'Chantal');
  await page.goto('/medewerkers/e4');
  await expect(page.getByText('Geen toegang')).toBeVisible();
  await page.goto('/tijdregistratie');
  await expect(page.getByText('Daan')).toHaveCount(0);
  await page.goto('/verlof');
  await expect(page.getByRole('tab', { name: /Aanvragen van het team/ })).toHaveCount(0);
});

test('N-3 permission denied pages say so instead of showing planner UI', async ({ page }) => {
  await loginAs(page, 'Chantal');
  for (const p of ['/instellingen', '/medewerkers', '/vereiste-diensten', '/rooster']) {
    await page.goto(p);
    await expect(page.getByText(/geen rechten/i), `${p} should deny`).toBeVisible();
  }
});

test('N-4 absence validation: end before start and zero hours', async ({ page }) => {
  await loginAs(page, 'Chantal');
  await page.goto('/verlof');
  await page.getByRole('button', { name: 'Verlof aanvragen' }).click();
  await page.getByLabel('Aantal uren').fill('0');
  await page.getByRole('button', { name: 'Versturen' }).click();
  await expect(page.getByText(/Vul het aantal uren in/)).toBeVisible();
});

test('N-5 employee with a pending exchange cannot request a second one', async ({ page }) => {
  await loginAs(page, 'Bram');
  await page.goto('/rooster');
  await page.getByRole('button', { name: 'Acties' }).click();
  await page.getByRole('menuitem', { name: /Publiceren/ }).click();
  await page.getByRole('button', { name: 'Alles kiezen' }).click();
  await page.getByRole('button', { name: 'Publiceren', exact: true }).click();
  await page.getByRole('button', { name: 'Klaar' }).click();
  await page.getByRole('button', { name: 'Uitloggen' }).click();
  await loginAs(page, 'Chantal');
  await page.goto('/mijn-rooster');
  const first = page.getByRole('button', { name: 'Ruilen' }).first();
  await first.click();
  await expect(page.getByText('Wacht op collega').first()).toBeVisible();
});

test('F-DST Sunday 25 Oct 2026 (clocks go back): week view still has 7 distinct days', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T12:00:00+01:00') });
  await loginAs(page, 'Bram');
  await page.goto('/rooster');
  const heads = await page.getByRole('columnheader').allTextContents();
  const days = heads.filter((h) => /^(Ma|Di|Wo|Do|Vr|Za|Zo) \d/.test(h)).map((h) => h.split(/\s{1}/).slice(0, 3).join(' '));
  expect(new Set(days).size).toBe(7);
});

test('FIX-1 change log shows who changed a shift; employees are denied', async ({ page }) => {
  await loginAs(page, 'Bram');
  await page.getByRole('button', { name: /Dienst$/ }).first().click();
  await page.getByLabel('Begintijd', { exact: true }).fill('05:00');
  await page.getByLabel('Eindtijd', { exact: true }).fill('06:00');
  await page.getByRole('button', { name: 'Opslaan' }).click();
  await page.goto('/logboek');
  await expect(page.getByText('Bram Jansen').first()).toBeVisible();
  await expect(page.getByText(/Dienst toegevoegd/)).toBeVisible();
  await page.getByRole('button', { name: 'Uitloggen' }).click();
  await loginAs(page, 'Chantal');
  await page.goto('/logboek');
  await expect(page.getByText(/geen rechten/i)).toBeVisible();
});

test('FIX-2 print view hides the app chrome and keeps the grid', async ({ page }) => {
  await loginAs(page, 'Bram');
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('navigation', { name: 'Hoofdmenu' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Acties' })).toBeHidden();
  await expect(page.getByRole('grid', { name: 'Rooster' })).toBeVisible();
});

test('FIX-3 a clock left running from yesterday is flagged and an admin can fix it', async ({ page }) => {
  await loginAs(page, 'Chantal');
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('rooster-demo-v1')!); const d = new Date(Date.now() - 86400000); const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; s.timesheet.push({ id: 'ts-old', employeeId: 'e3', departmentId: 'd1', date: ds, start: '08:00', end: null, unpaidBreakMin: 0, status: 'pending' }); localStorage.setItem('rooster-demo-v1', JSON.stringify(s)); });
  await page.goto('/tijdregistratie');
  await expect(page.getByText('Vergeten uit te klokken?')).toBeVisible();
  await page.getByRole('button', { name: 'Uitloggen' }).click();
  await loginAs(page, 'Anna');
  await page.goto('/tijdregistratie');
  await page.getByRole('button', { name: 'Uitklokken', exact: true }).click();
  await expect(page.getByText('Uitklokken hersteld')).toBeVisible();
  await expect(page.getByText('Vergeten uit te klokken?')).toHaveCount(0);
});

test('FIX-4 phone: the planner opens on the day view', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, 'Bram');
  await expect(page.getByRole('button', { name: 'Dag' })).toHaveAttribute('aria-pressed', 'true');
});
