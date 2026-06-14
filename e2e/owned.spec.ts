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

// Helper: pick a nature from the searchable Nature Select in the open dialog.
// Scoped to the dialog to avoid collision with the filter-bar Nature input,
// which is rendered on the owned list page whenever Pokémon are present.
async function selectNature(page: import('@playwright/test').Page, name: string) {
  const dialog = page.getByRole('dialog');
  const natureInput = dialog.getByRole('textbox', { name: 'Nature' });
  await natureInput.click();
  await natureInput.fill(name);
  const option = page.locator('[role="option"]', { hasText: name }).first();
  await option.waitFor({ state: 'visible' });
  await option.click();
}

// Helper: add a Pokémon through the form.
// `via` controls how the modal is opened: 'emptyState' for the first mon, 'header' for subsequent.
// `shiny` requires features.shiny to be enabled in the store before calling.
async function addPokemon(
  page: import('@playwright/test').Page,
  opts: { species: string; nature?: string; shiny?: boolean; via?: 'header' | 'emptyState' }
) {
  const { species, nature, shiny = false, via = 'header' } = opts;
  await openAddForm(page, via);
  const dialog = page.getByRole('dialog');
  await selectSpecies(page, species);
  if (nature) {
    // Scope the nature select to the dialog to avoid collision with the filter-bar Nature input
    const natureInput = dialog.getByRole('textbox', { name: 'Nature' });
    await natureInput.click();
    await natureInput.fill(nature);
    const option = page.locator('[role="option"]', { hasText: nature }).first();
    await option.waitFor({ state: 'visible' });
    await option.click();
  }
  if (shiny) {
    await dialog.getByLabel('Shiny').check();
  }
  await dialog.getByRole('button', { name: 'Add Pokémon' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByText(species)).toBeVisible();
}

// Helper: pick a filter Select value inside the owned-filter-bar.
// Clicks the combobox input by aria-label within the filter bar, then picks the option.
async function pickFilterSelect(
  page: import('@playwright/test').Page,
  label: string,
  value: string
) {
  const filterBar = page.getByTestId('owned-filter-bar');
  // Mantine Select renders a readonly textbox; aria-label is on the input element.
  // The dropdown opens on click and lists options in a portal at document body.
  const input = filterBar.getByRole('textbox', { name: label });
  await input.click();
  // Wait for options to appear (rendered in portal) and click the matching one
  const option = page.locator('[role="option"]', { hasText: value }).first();
  await option.waitFor({ state: 'visible' });
  await option.click();
  // Wait for option dropdown to close
  await expect(page.locator('[role="option"]', { hasText: value }).first()).not.toBeVisible();
}

// Helper: clear a filter Select inside the filter bar.
// Mantine's clear button has aria-hidden="true" and no aria-label, so it can't be found
// via getByRole. We locate the specific Select's clear button via its input element:
// the clear button (.mantine-InputClearButton-root) is a sibling of the labeled input
// inside the same .mantine-Input-wrapper.
async function clearFilterSelect(page: import('@playwright/test').Page, label: string) {
  // Navigate from the input → parent wrapper div → the clear button button inside it
  const inputEl = page.locator(`[data-testid="owned-filter-bar"] [aria-label="${label}"]`);
  // The clear button is a sibling of the input inside the same parent (.mantine-Input-wrapper)
  // XPath: parent of input → child button.mantine-InputClearButton-root
  const clearBtn = page.locator(
    `[data-testid="owned-filter-bar"] [aria-label="${label}"] ~ div button.mantine-InputClearButton-root`
  );
  await inputEl.waitFor({ state: 'visible' });
  await clearBtn.waitFor({ state: 'attached' });
  await clearBtn.click({ force: true });
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

    // Jolly should now appear in the card (the list renders mon.nature).
    // Scope to a Mantine Text element (not a span in a portal) to avoid strict-mode violations.
    await expect(page.locator('p.mantine-Text-root', { hasText: 'Jolly' })).toBeVisible();
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

  // ── Filter / Sort tests ──────────────────────────────────────────────────────
  // Seed: Bulbasaur (Adamant), Charmander (Jolly), Squirtle (Hardy/default).
  // All three have distinct species names and natures.

  // 8. Nature filter narrows results; clearing restores all
  test('filter by nature narrows the list and clearing the filter restores all Pokémon', async ({ page }) => {
    // Seed three Pokémon
    await addPokemon(page, { species: 'Bulbasaur', nature: 'Adamant', via: 'emptyState' });
    await addPokemon(page, { species: 'Charmander', nature: 'Jolly', via: 'header' });
    await addPokemon(page, { species: 'Squirtle', nature: 'Hardy', via: 'header' });

    // Apply Nature filter: Adamant
    await pickFilterSelect(page, 'Filter by nature', 'Adamant');

    // Only Bulbasaur should be visible; Charmander and Squirtle should be gone
    await expect(page.getByRole('button', { name: 'Edit Bulbasaur' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit Charmander' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit Squirtle' })).not.toBeVisible();

    // Clear the Nature filter
    await clearFilterSelect(page, 'Filter by nature');

    // All three should be visible again
    await expect(page.getByRole('button', { name: 'Edit Bulbasaur' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit Charmander' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit Squirtle' })).toBeVisible();
  });

  // 9. Shiny-only checkbox hides non-shiny; unchecking restores all
  test('shiny-only checkbox shows only shiny Pokémon and unchecking restores all', async ({ page }) => {
    // Enable shiny feature via localStorage before the store hydrates
    await page.evaluate(() => {
      const stored = localStorage.getItem('pokemmo-breeding-store');
      const parsed = stored ? JSON.parse(stored) : { state: { settings: { features: {} } }, version: 1 };
      parsed.state.settings = parsed.state.settings ?? {};
      parsed.state.settings.features = parsed.state.settings.features ?? {};
      parsed.state.settings.features.shiny = true;
      localStorage.setItem('pokemmo-breeding-store', JSON.stringify(parsed));
    });
    await page.reload();
    await page.waitForURL('**/#/owned');

    // Seed: Bulbasaur (not shiny), Charmander (shiny)
    await addPokemon(page, { species: 'Bulbasaur', via: 'emptyState' });
    await addPokemon(page, { species: 'Charmander', shiny: true, via: 'header' });

    // Both should be visible initially
    await expect(page.getByRole('button', { name: 'Edit Bulbasaur' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit Charmander' })).toBeVisible();

    // Check "Shiny only"
    const filterBar = page.getByTestId('owned-filter-bar');
    await filterBar.getByLabel('Shiny only').check();

    // Only shiny Charmander should remain
    await expect(page.getByRole('button', { name: 'Edit Charmander' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit Bulbasaur' })).not.toBeVisible();

    // Uncheck "Shiny only" — both should return
    await filterBar.getByLabel('Shiny only').uncheck();
    await expect(page.getByRole('button', { name: 'Edit Bulbasaur' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit Charmander' })).toBeVisible();
  });

  // 10. Sort by species name asc and desc
  test('sort by species name orders cards alphabetically and reverses on direction toggle', async ({ page }) => {
    // Seed Squirtle before Bulbasaur (so default date-added order is Squirtle first)
    await addPokemon(page, { species: 'Squirtle', via: 'emptyState' });
    await addPokemon(page, { species: 'Bulbasaur', via: 'header' });
    await addPokemon(page, { species: 'Charmander', via: 'header' });

    // Set Sort by to "Species name"
    const filterBar = page.getByTestId('owned-filter-bar');
    // Sort by is a non-searchable select; click the combobox
    const sortByInput = filterBar.getByRole('textbox', { name: 'Sort by' });
    await sortByInput.click();
    const nameOption = page.locator('[role="option"]', { hasText: 'Species name' }).first();
    await nameOption.waitFor({ state: 'visible' });
    await nameOption.click();

    // Default direction is asc — Bulbasaur < Charmander < Squirtle alphabetically
    const editButtons = page.getByRole('button', { name: /^Edit / });
    const firstAsc = editButtons.first();
    const lastAsc = editButtons.last();
    await expect(firstAsc).toHaveAccessibleName('Edit Bulbasaur');
    await expect(lastAsc).toHaveAccessibleName('Edit Squirtle');

    // Toggle direction to desc
    await filterBar.getByRole('button', { name: 'Sort direction' }).click();

    // Now Squirtle should be first, Bulbasaur last
    const firstDesc = editButtons.first();
    const lastDesc = editButtons.last();
    await expect(firstDesc).toHaveAccessibleName('Edit Squirtle');
    await expect(lastDesc).toHaveAccessibleName('Edit Bulbasaur');
  });

  // 11. No matches message when filter matches nothing
  test('shows "No Pokémon match your filters." when active filter matches no Pokémon', async ({ page }) => {
    // Seed: Bulbasaur (Adamant, default male) and Charmander (Jolly, default male).
    // The nature filter options derive from what's owned, so only Adamant and Jolly appear.
    // Filter by Nature=Adamant AND Gender=Female — Bulbasaur is male, so no match.
    await addPokemon(page, { species: 'Bulbasaur', nature: 'Adamant', via: 'emptyState' });
    await addPokemon(page, { species: 'Charmander', nature: 'Jolly', via: 'header' });

    // Apply Nature filter: Adamant — only Bulbasaur shows
    await pickFilterSelect(page, 'Filter by nature', 'Adamant');
    await expect(page.getByRole('button', { name: 'Edit Bulbasaur' })).toBeVisible();

    // Clear the nature filter, then use the search text input to produce zero matches
    await clearFilterSelect(page, 'Filter by nature');

    // Use the search text input (not inside the filter bar) to filter by a non-existent name
    const searchInput = page.getByLabel('Search Pokémon');
    await searchInput.fill('Mewtwo999');

    // No cards should appear; the "no match" message should show
    await expect(page.getByRole('button', { name: 'Edit Bulbasaur' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit Charmander' })).not.toBeVisible();
    await expect(page.getByText('No Pokémon match your filters.')).toBeVisible();
  });
});
