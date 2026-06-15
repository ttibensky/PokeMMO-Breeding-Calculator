import { test, expect, type Page } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Navigate to a route with a clean localStorage slate. */
async function freshStart(page: Page, hash = './#/settings') {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.goto(hash);
}

/** Drive a Mantine searchable Select (portal-rendered options at document level). */
async function selectOption(page: Page, inputName: string, optionText: string) {
  const input = page.getByRole('textbox', { name: inputName });
  await input.click();
  await input.fill(optionText);
  const option = page.locator('[role="option"]', { hasText: optionText }).first();
  await option.waitFor({ state: 'visible' });
  await option.click();
}

/**
 * Set a Mantine NumberInput (rendered as type="text") to a new value.
 * Triple-click selects all existing text, then type the new value.
 */
async function setNumberInput(page: Page, label: string, value: number) {
  const input = page.getByLabel(label);
  await input.click({ clickCount: 3 });
  await input.fill(String(value));
  await input.press('Tab');
}

/**
 * Extract the integer from a currency string or mixed text.
 * e.g. "Estimated total$20,000" → 20000
 */
function parseMoney(text: string): number {
  const digits = text.replace(/[^0-9]/g, '');
  return parseInt(digits, 10);
}

/**
 * Toggle a Mantine Switch by its exact label text.
 *
 * Mantine renders Switch as <input type="checkbox" role="switch"> with 0×0 CSS size
 * (opacity:0 / position:absolute), so Playwright's normal click/check require
 * visibility. The associated <label for="inputId"> element triggers the toggle
 * when clicked via JS even when it is outside the viewport.
 *
 * IMPORTANT: We anchor the regex to the START of the accessible name (`^Label`) so that
 * a label like "Alpha" doesn't accidentally match "Hidden AbilityShow ... Alpha Pokémon".
 * The accessible name is computed from the <label> text which is labelText + description.
 */
async function clickSwitch(page: Page, labelText: string) {
  // Anchor regex to start so "Alpha" doesn't match "Hidden Ability...Alpha Pokémon"
  const input = page.getByRole('switch', { name: new RegExp(`^${labelText}`) }).first();
  await input.evaluate((el) => {
    const id = el.id;
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) (label as HTMLElement).click();
    else el.click(); // fallback
  });
}

/**
 * Return the hidden switch input for state assertions.
 * toBeChecked() does NOT require visibility — it reads the .checked property.
 * Use start-anchored regex to avoid "Alpha" matching "Hidden Ability ... Alpha Pokémon".
 */
function switchInput(page: Page, labelText: string) {
  return page.getByRole('switch', { name: new RegExp(`^${labelText}`) }).first();
}

/** Create a 2×31 (HP + Atk) Bulbasaur project (localStorage already cleared). */
async function createBulbasaurProject(page: Page, name: string) {
  await page.goto('./#/projects');
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();

  await page.getByRole('button', { name: 'Create your first project' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.getByLabel('Project name').fill(name);
  await selectOption(page, 'Species', 'Bulbasaur');
  await page.getByRole('checkbox', { name: 'Target HP' }).check();
  await page.getByRole('checkbox', { name: 'Target Atk' }).check();

  await page.getByRole('dialog').getByRole('button', { name: 'Create Project' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByText(name)).toBeVisible();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Settings page', () => {
  // ── 1a. Shiny feature toggle reveals / hides field in Owned Add form ────────
  test('Shiny toggle reveals and hides the Shiny checkbox in the Owned Add form', async ({ page }) => {
    await freshStart(page, './#/settings');

    // Turn Shiny ON by clicking its visible label span
    await clickSwitch(page, 'Shiny');
    await expect(switchInput(page, 'Shiny')).toBeChecked();

    // Navigate to Owned → open Add form
    await page.goto('./#/owned');
    await page.getByRole('button', { name: 'Add your first Pokémon' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const dialog = page.getByRole('dialog');
    // Inside OwnedPokemonForm, Shiny is a Mantine <Checkbox> (role="checkbox")
    await expect(dialog.getByRole('checkbox', { name: 'Shiny' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Turn Shiny OFF
    await page.goto('./#/settings');
    await clickSwitch(page, 'Shiny');
    await expect(switchInput(page, 'Shiny')).not.toBeChecked();

    // Reopen Owned Add form → Shiny checkbox must be gone
    await page.goto('./#/owned');
    await page.getByRole('button', { name: 'Add your first Pokémon' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const dialog2 = page.getByRole('dialog');
    await expect(dialog2.getByRole('checkbox', { name: 'Shiny' })).not.toBeVisible();
    await dialog2.getByRole('button', { name: 'Cancel' }).click();
  });

  // ── 1b. Alpha feature toggle reveals / hides field in Owned Add form ────────
  test('Alpha toggle reveals and hides the Alpha checkbox in the Owned Add form', async ({ page }) => {
    await freshStart(page, './#/settings');

    // Turn Alpha ON
    await clickSwitch(page, 'Alpha');
    await expect(switchInput(page, 'Alpha')).toBeChecked();

    // Open Owned Add form — Alpha checkbox should appear
    await page.goto('./#/owned');
    await page.getByRole('button', { name: 'Add your first Pokémon' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('checkbox', { name: 'Alpha' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    // Turn Alpha OFF
    await page.goto('./#/settings');
    await clickSwitch(page, 'Alpha');
    await expect(switchInput(page, 'Alpha')).not.toBeChecked();

    // Reopen Owned Add form → Alpha checkbox must be gone
    await page.goto('./#/owned');
    await page.getByRole('button', { name: 'Add your first Pokémon' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const dialog2 = page.getByRole('dialog');
    await expect(dialog2.getByRole('checkbox', { name: 'Alpha' })).not.toBeVisible();
    await dialog2.getByRole('button', { name: 'Cancel' }).click();
  });

  // ── 2. Price change shifts the project estimate total ───────────────────────
  test('raising Power Weight price increases the project estimate total', async ({ page }) => {
    // Fresh start and create a Bulbasaur 2×31 project
    await page.goto('./');
    await page.evaluate(() => localStorage.clear());
    await createBulbasaurProject(page, 'Bulba HP+Atk');

    // Open project detail and read the baseline estimated total
    await page.getByText('Bulba HP+Atk').click();
    await expect(page.getByRole('heading', { name: 'Bulba HP+Atk' })).toBeVisible();
    await expect(page.getByText('Estimated total')).toBeVisible();

    // The "Estimated total" label and its money value are siblings in a Group row.
    // Grab the whole row text content and parse out all digits.
    const totalRow = page.locator('text=Estimated total').locator('..');
    const baselineTotalText = (await totalRow.textContent()) ?? '';
    const baselineTotal = parseMoney(baselineTotalText);
    expect(baselineTotal).toBeGreaterThan(0);

    // Raise Power Weight (HP) price from $10,000 → $40,000
    await page.goto('./#/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await setNumberInput(page, 'Power Weight (HP)', 40000);

    // Return to project detail and verify total increased
    await page.goto('./#/projects');
    await page.getByText('Bulba HP+Atk').click();
    await expect(page.getByRole('heading', { name: 'Bulba HP+Atk' })).toBeVisible();

    const totalRow2 = page.locator('text=Estimated total').locator('..');
    const newTotalText = (await totalRow2.textContent()) ?? '';
    const newTotal = parseMoney(newTotalText);

    expect(newTotal).toBeGreaterThan(baselineTotal);
  });

  // ── 3. Settings persist across page reload ──────────────────────────────────
  test('changed price and feature toggle persist after a page reload', async ({ page }) => {
    await freshStart(page, './#/settings');

    // Change Ability Pill price to $50,000
    await setNumberInput(page, 'Ability Pill', 50000);

    // Enable Shiny toggle
    await clickSwitch(page, 'Shiny');
    await expect(switchInput(page, 'Shiny')).toBeChecked();

    // Reload
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    // Ability Pill should still show $50,000
    await expect(page.getByLabel('Ability Pill')).toHaveValue('$50,000');

    // Shiny switch should still be on
    await expect(switchInput(page, 'Shiny')).toBeChecked();
  });

  // ── 4. Color scheme (dark mode) can be set and persists ─────────────────────
  test('color scheme can be set to dark and persists across reload', async ({ page }) => {
    await freshStart(page, './#/settings');

    // Select the Dark color scheme in the Appearance segmented control
    await page.getByText('Dark', { exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute(
      'data-mantine-color-scheme',
      'dark'
    );

    // Reload — the preference should persist
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute(
      'data-mantine-color-scheme',
      'dark'
    );
  });

  // ── 5. Cost Optimizer toggle and base-carrier price ─────────────────────────
  test('Cost Optimizer toggle and base-carrier price persist and keep the project page working', async ({ page }) => {
    await page.goto('./');
    await page.evaluate(() => localStorage.clear());
    await createBulbasaurProject(page, 'Optimizer E2E');

    await page.goto('./#/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    // default off
    await expect(switchInput(page, 'Cost Optimizer')).not.toBeChecked();

    await setNumberInput(page, 'Base Carrier', 20000);
    await clickSwitch(page, 'Cost Optimizer');
    await expect(switchInput(page, 'Cost Optimizer')).toBeChecked();

    await page.reload();
    await expect(switchInput(page, 'Cost Optimizer')).toBeChecked();
    await expect(page.getByLabel('Base Carrier')).toHaveValue('$20,000');

    // project page must render with the optimizer active
    await page.goto('./#/projects');
    await page.getByText('Optimizer E2E').click();
    await expect(page.getByRole('heading', { name: 'Optimizer E2E' })).toBeVisible();
  });

  // ── 6. Reset to defaults restores original values ──────────────────────────
  test('Reset to defaults restores prices and feature toggles to their defaults', async ({ page }) => {
    await freshStart(page, './#/settings');

    // Mutate a price and a toggle
    await setNumberInput(page, 'Ability Pill', 99000);
    await clickSwitch(page, 'Shiny');
    await expect(switchInput(page, 'Shiny')).toBeChecked();

    // Register dialog acceptor BEFORE triggering the confirm dialog
    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Reset to defaults' }).click();

    // Ability Pill should revert to default $35,000
    await expect(page.getByLabel('Ability Pill')).toHaveValue('$35,000');

    // Shiny switch should be back OFF (default false)
    await expect(switchInput(page, 'Shiny')).not.toBeChecked();
  });
});
