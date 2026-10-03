import { defineConfig } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';

// Use the pre-installed Chromium when present (no browser download).
function chromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  for (const dir of readdirSync(root).filter((d) => d.startsWith('chromium-') && !d.includes('headless'))) {
    for (const sub of ['chrome-linux/chrome', 'chrome-linux64/chrome']) {
      const p = `${root}/${dir}/${sub}`;
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://localhost:3100', launchOptions: { executablePath: chromium() }, trace: 'retain-on-failure' },
  webServer: { command: 'npx next start -p 3100', url: 'http://localhost:3100/login', reuseExistingServer: true, timeout: 60_000 },
});
