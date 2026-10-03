import { test as base, expect } from '@playwright/test';

/** Every test fails on console errors, uncaught exceptions and any 5xx response. */
export const test = base.extend<{ guard: void }>({
  guard: [async ({ page }, use) => {
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push(`console: ${m.text()}`); });
    page.on('response', (r) => { if (r.status() >= 400 && new URL(r.url()).origin === 'http://localhost:3100') problems.push(`HTTP ${r.status()} ${r.url()}`); if (r.status() >= 500) problems.push(`HTTP ${r.status()} ${r.url()}`); });
    await use();
    expect(problems, 'console errors / 5xx during the test').toEqual([]);
  }, { auto: true }],
});
export { expect };
