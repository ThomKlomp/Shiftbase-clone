import { test } from '@playwright/test';
import { freshDemo, loginAs } from './helpers';

// Reference screenshots of the clone for replica-diff: S-IDs from the recon map.
const SCREENS: [string, string, string][] = [
  ['S03', 'Bram', '/rooster'], ['S05', 'Bram', '/open-diensten'], ['S09', 'Bram', '/ruilen'], ['S10', 'Anna', '/medewerkers'],
  ['S12', 'Chantal', '/beschikbaarheid'], ['S13', 'Bram', '/verlof'], ['S08', 'Bram', '/vereiste-diensten'], ['S15', 'Bram', '/tijdregistratie'],
  ['S17', 'Anna', '/instellingen'], ['S22', 'Chantal', '/meldingen'], ['S23', 'Chantal', '/mijn-rooster'],
];
for (const [id, who, path] of SCREENS) {
  for (const [label, w, h] of [['1440', 1440, 900], ['390', 390, 844]] as const) {
    test(`${id} at ${label}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await freshDemo(page);
      await loginAs(page, who);
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `replica/clone-screens/${id}-${label}.png`, fullPage: false });
    });
  }
}

// The product screenshot used on the landing page: a published week, own demo data.
test('landing screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await freshDemo(page);
  await loginAs(page, 'Bram');
  await page.getByRole('button', { name: 'Acties' }).click();
  await page.getByRole('menuitem', { name: /Publiceren/ }).click();
  await page.getByRole('button', { name: 'Alles kiezen' }).click();
  await page.getByRole('button', { name: 'Publiceren', exact: true }).click();
  await page.getByRole('button', { name: 'Klaar' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'public/screens/rooster.png' });
});
