import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { freshDemo, loginAs } from './helpers';

const PAGES: [string, string][] = [
  ['Bram', '/rooster'], ['Bram', '/logboek'], ['Anonymous', '/'], ['Bram', '/open-diensten'], ['Bram', '/ruilen'], ['Anna', '/medewerkers'], ['Chantal', '/beschikbaarheid'],
  ['Bram', '/verlof'], ['Bram', '/vereiste-diensten'], ['Bram', '/tijdregistratie'], ['Anna', '/instellingen'], ['Chantal', '/meldingen'],
  ['Chantal', '/mijn-rooster'], ['Chantal', '/meer'],
];
for (const [who, path] of PAGES) {
  for (const [label, w, h] of [['desktop', 1440, 900], ['mobile', 390, 844]] as const) {
    test(`axe: ${path} as ${who} (${label})`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await freshDemo(page);
      if (who !== 'Anonymous') await loginAs(page, who);
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}x ${v.nodes[0].target}`)).toEqual([]);
    });
  }
}

test('axe: login and the shift drawer', async ({ page }) => {
  await freshDemo(page);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((v) => v.id)).toEqual([]);
  await loginAs(page, 'Bram');
  await page.getByRole('button', { name: /Dienst$/ }).first().click();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((v) => v.id)).toEqual([]);
});
