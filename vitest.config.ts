import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  test: { include: ['tests/unit/**/*.test.ts', 'tests/db/**/*.test.ts', 'tests/server/**/*.test.ts'], testTimeout: 60000 },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
