import { expect, type Page } from '@playwright/test';

export async function loginAs(page: Page, name: string) {
  await page.goto('/login');
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}
export async function freshDemo(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
}
export const noErrors = (page: Page) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });
  return () => expect(errs, 'console errors').toEqual([]);
};
