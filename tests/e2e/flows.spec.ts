import { expect, test } from './fixtures';
import { freshDemo, loginAs, noErrors } from './helpers';

test.beforeEach(async ({ page }) => { await freshDemo(page); });

test('F01 planner creates and publishes, employee then sees the shift', async ({ page }) => {
  const check = noErrors(page);
  await loginAs(page, 'Bram');
  await expect(page.getByRole('heading', { name: 'Rooster', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Dienst$/ }).first().click();
  await page.getByLabel('Medewerker', { exact: true }).selectOption({ label: 'Daan Visser' });
  await page.getByLabel('Begintijd', { exact: true }).fill('06:00');
  await page.getByLabel('Eindtijd', { exact: true }).fill('07:00');
  await page.getByRole('button', { name: 'Opslaan' }).click();
  await expect(page.getByText('Dienst toegevoegd')).toBeVisible();
  // publish all 7 days
  await page.getByRole('button', { name: 'Acties' }).click();
  await page.getByRole('menuitem', { name: /Publiceren/ }).click();
  await page.getByRole('button', { name: 'Alles kiezen' }).click();
  await page.getByRole('button', { name: 'Publiceren', exact: true }).click();
  await expect(page.getByText('Gepubliceerd', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Klaar' }).click();
  // employee side
  await page.getByRole('button', { name: 'Uitloggen' }).click();
  await loginAs(page, 'Daan');
  await page.goto('/mijn-rooster');
  await expect(page.getByText('06:00–07:00')).toBeVisible();
  await page.goto('/meldingen');
  await expect(page.getByText('Het rooster is gepubliceerd')).toBeVisible();
  check();
});

test('employee sees nothing before publish', async ({ page }) => {
  await loginAs(page, 'Chantal');
  await page.goto('/mijn-rooster');
  await expect(page.getByText('Nog niets gepubliceerd')).toBeVisible();
});

test('employee cannot reach planner pages through the menu', async ({ page }) => {
  await loginAs(page, 'Chantal');
  const nav = page.getByRole('navigation', { name: 'Hoofdmenu' });
  await expect(nav.getByRole('link', { name: 'Rooster', exact: true })).toHaveCount(0);
  await page.goto('/rooster');
  await expect(page.getByText(/geen rechten/i)).toBeVisible();
});

test('F02 absence: request, warning on low balance, approve with override', async ({ page }) => {
  await loginAs(page, 'Chantal');
  await page.goto('/verlof');
  await page.getByRole('button', { name: 'Verlof aanvragen' }).click();
  await page.getByLabel('Aantal uren').fill('500');
  await page.getByRole('button', { name: 'Versturen' }).click();
  await expect(page.getByText('Aanvraag verstuurd')).toBeVisible();
  await page.getByRole('button', { name: 'Uitloggen' }).click();
  await loginAs(page, 'Bram');
  await page.goto('/verlof');
  await page.getByRole('tab', { name: /Aanvragen van het team/ }).click();
  await expect(page.getByText(/Saldo te laag/)).toBeVisible();
  await page.getByRole('button', { name: 'Goedkeuren', exact: true }).click();
  await expect(page.getByText(/Saldo is niet genoeg/)).toBeVisible();
  await page.getByRole('button', { name: 'Toch goedkeuren' }).click();
  await expect(page.getByText('Goedgekeurd met overschrijven')).toBeVisible();
});

test('F03 availability shows in the planner grid', async ({ page }) => {
  await loginAs(page, 'Chantal');
  await page.goto('/beschikbaarheid');
  await page.getByLabel(/^Beschikbaarheid /).first().selectOption('unavailable_all_day');
  await page.getByRole('button', { name: 'Opslaan' }).click();
  await expect(page.getByText('Beschikbaarheid opgeslagen')).toBeVisible();
  await page.getByRole('button', { name: 'Uitloggen' }).click();
  await loginAs(page, 'Bram');
  await page.getByRole('button', { name: 'Volgende', exact: true }).click();
  await expect(page.getByText('Niet beschikbaar', { exact: true }).first()).toBeVisible();
});

test('F04 open shift: invite, request, assign', async ({ page }) => {
  await loginAs(page, 'Bram');
  await page.goto('/open-diensten');
  await page.getByRole('button', { name: /Nodig \d+ medewerker/ }).first().click();
  await page.getByRole('button', { name: 'Uitloggen' }).click();
  await loginAs(page, 'Chantal');
  await page.goto('/open-diensten');
  await page.getByRole('button', { name: 'Ik wil deze dienst' }).first().click();
  await expect(page.getByText('Aangevraagd').first()).toBeVisible();
  await page.getByRole('button', { name: 'Uitloggen' }).click();
  await loginAs(page, 'Bram');
  await page.goto('/open-diensten');
  await page.getByRole('button', { name: 'Indelen' }).first().click();
  await expect(page.getByText('Ingedeeld').first()).toBeVisible();
});

test('F05 exchange: request, colleague accepts, planner approves', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Ruilen' }).first().click();
  await page.getByRole('button', { name: 'Uitloggen' }).click();
  await loginAs(page, 'Daan');
  await page.goto('/ruilen');
  await page.getByRole('button', { name: 'Overnemen' }).click();
  await page.getByRole('button', { name: 'Uitloggen' }).click();
  await loginAs(page, 'Bram');
  await page.goto('/ruilen');
  await page.getByRole('button', { name: 'Goedkeuren' }).click();
  await expect(page.getByText('Goedgekeurd', { exact: true }).first()).toBeVisible();
});

test('keyboard only: add a shift from the grid without a mouse', async ({ page }) => {
  await loginAs(page, 'Bram');
  await page.getByRole('button', { name: /Dienst toevoegen voor Chantal/ }).first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('validation: end equals start is rejected', async ({ page }) => {
  await loginAs(page, 'Bram');
  await page.getByRole('button', { name: /Dienst$/ }).first().click();
  await page.getByLabel('Begintijd', { exact: true }).fill('08:00');
  await page.getByLabel('Eindtijd', { exact: true }).fill('08:00');
  await page.getByRole('button', { name: 'Opslaan' }).click();
  await expect(page.getByText(/mogen niet hetzelfde zijn/)).toBeVisible();
});
