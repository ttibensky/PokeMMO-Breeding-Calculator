import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:4173/PokeMMO-Breeding-Calculator/',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173/PokeMMO-Breeding-Calculator/',
    reuseExistingServer: !process.env['CI'],
    timeout: 60000,
  },
});
