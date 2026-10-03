import { test } from './fixtures';
// Placeholder so the guard also covers the landing page load.
test('landing loads without console errors or failing requests', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('heading', { level: 1 }).waitFor();
});
