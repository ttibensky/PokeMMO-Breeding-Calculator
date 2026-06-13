import { test, expect } from '@playwright/test';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Navigate to a page with a clean localStorage slate. */
async function freshStart(page: import('@playwright/test').Page, hash = './') {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  if (hash !== './') {
    await page.goto(hash);
  }
}

/** Drive a Mantine searchable Select (portal-rendered options). */
async function selectOption(page: import('@playwright/test').Page, inputName: string, optionText: string) {
  const input = page.getByRole('textbox', { name: inputName });
  await input.click();
  await input.fill(optionText);
  const option = page.locator('[role="option"]', { hasText: optionText }).first();
  await option.waitFor({ state: 'visible' });
  await option.click();
}

/** Add a Bulbasaur with HP IV 31 to the Owned page. Assumes Owned page is already loaded and empty. */
async function addBulbasaurWithHPIV(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Add your first Pokémon' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await selectOption(page, 'Species', 'Bulbasaur');

  const hpInput = page.getByLabel('HP');
  await hpInput.fill('31');
  await hpInput.press('Tab');

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Add Pokémon' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByText('Bulbasaur')).toBeVisible();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('404 / not-found route', () => {
  test.beforeEach(async ({ page }) => {
    await freshStart(page);
  });

  test('shows not-found message and nav for an unknown hash route', async ({ page }) => {
    await page.goto('/PokeMMO-Breeding-Calculator/#/does-not-exist');

    // Not-found heading and text must be visible
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page.getByText('The page you are looking for does not exist.')).toBeVisible();

    // The app shell nav must still be present (links to the main routes)
    await expect(page.getByRole('link', { name: 'Owned', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Projects', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Settings', exact: true })).toBeVisible();
  });

  test('back-to-app button navigates to the Owned page', async ({ page }) => {
    await page.goto('/PokeMMO-Breeding-Calculator/#/does-not-exist');

    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();

    // Click the "Go to Owned Pokémon" button (rendered as a Link/Button)
    await page.getByRole('link', { name: 'Go to Owned Pokémon' }).click();

    // Should land on the Owned page
    await expect(page.getByRole('heading', { name: 'Owned Pokémon' })).toBeVisible();
  });
});

test.describe('Export → import round-trip', () => {
  test('exports data to JSON, wipes slate, imports it back, data is restored', async ({ page }) => {
    // ── Step 1: Add a Bulbasaur with HP 31 to Owned ───────────────────────────
    await freshStart(page, './#/owned');
    await addBulbasaurWithHPIV(page);

    // ── Step 2: Export from Settings ─────────────────────────────────────────
    await page.goto('./#/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export data' }).click(),
    ]);

    // Filename must end with .json
    expect(download.suggestedFilename()).toMatch(/\.json$/);

    // Save to a temp path and parse it
    const tmpPath = path.join(os.tmpdir(), `pokemmo-export-test-${Date.now()}.json`);
    await download.saveAs(tmpPath);

    const raw = fs.readFileSync(tmpPath, 'utf-8');
    const bundle = JSON.parse(raw) as {
      app: string;
      data: { ownedPokemon: Array<{ speciesId: number }> };
    };

    // The bundle must contain Bulbasaur (speciesId 1)
    expect(bundle.app).toBe('pokemmo-breeding-calculator');
    expect(bundle.data.ownedPokemon.length).toBeGreaterThan(0);
    const bulbasaur = bundle.data.ownedPokemon.find((p) => p.speciesId === 1);
    expect(bulbasaur).toBeDefined();

    // ── Step 3: Wipe localStorage and confirm data is gone ────────────────────
    // localStorage.clear() removes the persisted data, but Zustand's in-memory
    // state is still live. Reloading from scratch lets the store re-initialize
    // from the (now empty) localStorage, giving us a true clean slate.
    await page.evaluate(() => localStorage.clear());
    await page.goto('./');                // navigate away to trigger fresh load
    await page.goto('./#/owned');
    await expect(page.getByText('No Pokémon yet')).toBeVisible();

    // ── Step 4: Import the saved file ─────────────────────────────────────────
    await page.goto('./#/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    // Register dialog handler BEFORE triggering the file input change
    page.on('dialog', (d) => d.accept());

    // The file input is a native <input type="file"> (not hidden, has an id)
    const fileInput = page.locator('#import-file-input');
    await fileInput.setInputFiles(tmpPath);

    // Success alert should appear
    await expect(page.getByRole('alert').filter({ hasText: 'Import successful' })).toBeVisible();
    await expect(page.getByText(/Imported 1 Pokémon and 0 projects/)).toBeVisible();

    // ── Step 5: Navigate to Owned and verify Bulbasaur is restored ─────────────
    await page.goto('./#/owned');
    await expect(page.getByText('Bulbasaur')).toBeVisible();
    await expect(page.getByText('No Pokémon yet')).not.toBeVisible();

    // Cleanup temp file
    fs.unlinkSync(tmpPath);
  });
});

test.describe('Import invalid file shows an error', () => {
  test.beforeEach(async ({ page }) => {
    await freshStart(page, './#/settings');
  });

  test('shows an error alert when an invalid JSON file is imported', async ({ page }) => {
    // Register dialog acceptor so the confirm prompt is auto-accepted
    page.on('dialog', (d) => d.accept());

    const fileInput = page.locator('#import-file-input');
    await fileInput.setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from('not json{'),
    });

    // Error alert must appear
    await expect(page.getByRole('alert').filter({ hasText: 'Import failed' })).toBeVisible();
    await expect(page.getByText(/Invalid JSON/)).toBeVisible();

    // App shell nav must still be present (app did not crash)
    await expect(page.getByRole('link', { name: 'Owned', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Projects', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Settings', exact: true })).toBeVisible();
  });
});
