import { defineConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';

function resolvePreviewPort(): number {
  if (process.env['PREVIEW_PORT']) {
    return Number(process.env['PREVIEW_PORT']);
  }
  try {
    const contents = readFileSync('.env.local', 'utf8');
    const match = contents.match(/^PREVIEW_PORT=(\d+)/m);
    if (match) {
      return Number(match[1]);
    }
  } catch {
    // No .env.local (e.g. the main checkout) — fall through to the default.
  }
  return 3001;
}

const previewPort = resolvePreviewPort();
const baseURL = `http://localhost:${previewPort}/PokeMMO-Breeding-Calculator/`;

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL,
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    timeout: 60000,
  },
});
