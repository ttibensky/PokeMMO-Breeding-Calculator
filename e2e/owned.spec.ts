import { test, expect } from '@playwright/test';

// Helper: open the add-pokemon modal.
// When the list is empty, use the empty-state button; otherwise use the header button.
async function openAddForm(page: import('@playwright/test').Page, via: 'header' | 'emptyState' = 'header') {
  if (via === 'emptyState') {
    await page.getByRole('button', { name: 'Add your first Pokémon' }).click();
  } else {
    await page.getByTestId('global-add-pokemon').click();
  }
  await expect(page.getByRole('dialog')).toBeVisible();
}

// Helper: interact with a Mantine searchable Select to pick a species.
// Mantine renders the dropdown in a portal at document body; options have role="option".
// The Select input has no role="combobox" — it is a plain textbox with aria-label.
// NOTE: exact:true does NOT work because the accessible name includes the sprite img alt text,
// so we use exact:false (the default). Searching for the full name is precise enough.
async function selectSpecies(page: import('@playwright/test').Page, name: string) {
  const speciesInput = page.getByRole('textbox', { name: 'Species' });
  await speciesInput.click();
  await speciesInput.fill(name);
  // Wait for filtered options to appear, then pick the one that matches
  const option = page.locator('[role="option"]', { hasText: name }).first();
  await option.waitFor({ state: 'visible' });
  await option.click();
}

// Helper: pick a nature from the searchable Nature Select.
async function selectNature(page: import('@playwright/test').Page, name: string) {
  const natureInput = page.getByRole('textbox', { name: 'Nature' });
  await natureInput.click();
  await natureInput.fill(name);
  const option = page.locator('[role="option"]', { hasText: name }).first();
  await option.waitFor({ state: 'visible' });
  await option.click();
}

test.describe('Owned Pokémon page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate first so localStorage is accessible, then clear it to guarantee empty state.
    await page.goto('./');
    await page.evaluate(() => localStorage.clear());
    await page.goto('./#/owned');
  });

  // Guard: the page-level Add button is gone; only the global header button remains.
  test('has no page-level Add button — only the global header Add button', async ({ page }) => {
    await expect(page.getByTestId('global-add-pokemon')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Pokémon', exact: true })).toHaveCount(1);
  });

  // 1. Empty state on first run
  test('shows heading and empty state when no Pokémon have been added', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Owned Pokémon' })).toBeVisible();
    await expect(page.getByText('No Pokémon yet')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add your first Pokémon' })).toBeVisible();
  });

  // 2. Add a Pokémon via search + assert it appears in the list
  test('adds a Pokémon through the form and shows it in the list', async ({ page }) => {
    await openAddForm(page, 'emptyState');

    // Pick Bulbasaur from the searchable species select
    await selectSpecies(page, 'Bulbasaur');

    // Set HP IV to 31 (Mantine NumberInput renders as type="text" with aria-label)
    const hpInput = page.getByLabel('HP');
    await hpInput.fill('31');
    await hpInput.press('Tab');

    // Set Atk IV to 31
    const atkInput = page.getByLabel('Atk');
    await atkInput.fill('31');
    await atkInput.press('Tab');

    // Pick Adamant nature
    await selectNature(page, 'Adamant');

    // Submit — scope to dialog to avoid the header "Add Pokémon" button
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Add Pokémon' }).click();

    // Modal should close
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Bulbasaur card should appear in the list
    await expect(page.getByText('Bulbasaur')).toBeVisible();

    // The owned-list card sprite renders at the large size token (120px)
    const cardSprite = page.getByRole('img', { name: 'Bulbasaur' });
    await expect(cardSprite).toHaveAttribute('width', '120');
    await expect(cardSprite).toHaveAttribute('height', '120');
    // The sprite is zoomed/cropped via a CSS transform (matrix, not identity)
    const transform = await cardSprite.evaluate((el) => getComputedStyle(el).transform);
    expect(transform).not.toBe('none');
    expect(transform).toContain('matrix');
  });

  // 3. Progressive disclosure: feature-gated fields are NOT shown by default
  test('does not show Shiny, Alpha, or Egg Moves fields when features are off (default)', async ({ page }) => {
    await openAddForm(page, 'emptyState');

    const dialog = page.getByRole('dialog');

    // Shiny and Alpha are rendered as Checkbox elements — only when features.shiny/alpha are true
    await expect(dialog.getByText('Shiny')).not.toBeVisible();
    await expect(dialog.getByText('Alpha')).not.toBeVisible();
    // Egg Moves is a TagsInput — only rendered when features.eggMoves is true
    await expect(dialog.getByText('Egg Moves')).not.toBeVisible();

    await dialog.getByRole('button', { name: 'Cancel' }).click();
  });

  // 4. Edit a Pokémon: open edit form pre-filled, change a value, save, confirm change
  test('edits an existing Pokémon and reflects the change in the list', async ({ page }) => {
    // First add Bulbasaur with Hardy nature (default first nature)
    await openAddForm(page, 'emptyState');
    await selectSpecies(page, 'Bulbasaur');
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Add Pokémon' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('Bulbasaur')).toBeVisible();

    // Click Edit Bulbasaur
    await page.getByRole('button', { name: 'Edit Bulbasaur' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Edit Pokémon')).toBeVisible();

    // Change Def IV to 31
    const defInput = page.getByLabel('Def');
    await defInput.fill('31');
    await defInput.press('Tab');

    // Change nature to Jolly
    await selectNature(page, 'Jolly');

    // Save
    await page.getByRole('dialog').getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Jolly should now appear in the card (the list renders mon.nature)
    await expect(page.getByText('Jolly')).toBeVisible();
  });

  // 5. Delete a Pokémon: confirm dialog → mon removed → empty state restored
  test('deletes a Pokémon and returns to the empty state', async ({ page }) => {
    // Add Bulbasaur first
    await openAddForm(page, 'emptyState');
    await selectSpecies(page, 'Bulbasaur');
    const addDialog = page.getByRole('dialog');
    await addDialog.getByRole('button', { name: 'Add Pokémon' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('Bulbasaur')).toBeVisible();

    // Click Delete — this opens a confirmation modal
    await page.getByRole('button', { name: 'Delete Bulbasaur' }).click();

    // Confirmation dialog appears
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/Remove Bulbasaur from your collection/)).toBeVisible();

    // Confirm removal
    await page.getByRole('button', { name: 'Remove' }).click();

    // Dialog closes and we're back to empty state
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('No Pokémon yet')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add your first Pokémon' })).toBeVisible();
  });

  // 6. Persistence across reload via Zustand + localStorage
  test('persists added Pokémon after a page reload', async ({ page }) => {
    await openAddForm(page, 'emptyState');
    await selectSpecies(page, 'Bulbasaur');
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Add Pokémon' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('Bulbasaur')).toBeVisible();

    // Reload the page — Zustand persists to localStorage key 'pokemmo-breeding-store'
    await page.reload();

    // Bulbasaur should still be in the list after reload
    await expect(page.getByText('Bulbasaur')).toBeVisible();
    await expect(page.getByText('No Pokémon yet')).not.toBeVisible();
  });

  // 7. Duplicate a Pokémon: prefilled form creates an independent copy
  test('duplicates a Pokémon with prefilled values and adds an independent copy', async ({ page }) => {
    // Add Bulbasaur with HP IV 31 as the source
    await openAddForm(page, 'emptyState');
    await selectSpecies(page, 'Bulbasaur');
    const hpInput = page.getByLabel('HP');
    await hpInput.fill('31');
    await hpInput.press('Tab');
    let dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Add Pokémon' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Exactly one Bulbasaur card so far
    await expect(page.getByRole('button', { name: 'Edit Bulbasaur' })).toHaveCount(1);

    // Click Duplicate
    await page.getByRole('button', { name: 'Duplicate Bulbasaur' }).click();
    dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Modal is in duplicate mode and prefilled
    await expect(dialog).toContainText('Duplicate Pokémon');
    await expect(page.getByRole('textbox', { name: 'Species' })).toHaveValue('Bulbasaur');
    await expect(page.getByLabel('HP')).toHaveValue('31');

    // Save the duplicate (add mode -> "Add Pokémon")
    await dialog.getByRole('button', { name: 'Add Pokémon' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Two independent Bulbasaur cards now exist
    await expect(page.getByRole('button', { name: 'Edit Bulbasaur' })).toHaveCount(2);
  });
});
