import { test, expect } from '@playwright/test';

// Pick a species from the searchable Species Select (portal-rendered options).
async function selectSpecies(page: import('@playwright/test').Page, name: string) {
  const speciesInput = page.getByRole('textbox', { name: 'Species' });
  await speciesInput.click();
  await speciesInput.fill(name);
  const option = page.locator('[role="option"]', { hasText: name }).first();
  await option.waitFor({ state: 'visible' });
  await option.click();
}

test.describe('Global Add Pokémon — OwnedPage query param', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    await page.evaluate(() => localStorage.clear());
  });

  test('auto-opens the add form from ?add=1 and returns to returnTo on submit', async ({ page }) => {
    await page.goto('./#/owned?add=1&returnTo=%2Fprojects');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await selectSpecies(page, 'Bulbasaur');
    await dialog.getByRole('button', { name: 'Add Pokémon' }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page).toHaveURL(/#\/projects$/);
    await expect(page.getByText('Pokémon added')).toBeVisible();
  });

  test('returns to returnTo on cancel without adding or toasting', async ({ page }) => {
    await page.goto('./#/owned?add=1&returnTo=%2Fprojects');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page).toHaveURL(/#\/projects$/);
    await expect(page.getByText('Pokémon added')).not.toBeVisible();
  });
});

test.describe('Global Add Pokémon — header button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    await page.evaluate(() => localStorage.clear());
  });

  test('header button is visible on the projects page and opens the add form', async ({ page }) => {
    await page.goto('./#/projects');

    const addBtn = page.getByTestId('global-add-pokemon');
    await expect(addBtn).toBeVisible();

    await addBtn.click();
    await expect(page).toHaveURL(/#\/owned\?add=1/);
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('adds a captured Pokémon from a project detail page and returns there', async ({ page }) => {
    // Create a project from the empty state.
    await page.goto('./#/projects');
    await page.getByRole('button', { name: 'Create your first project' }).click();
    const goalDialog = page.getByRole('dialog');
    await expect(goalDialog).toBeVisible();
    await page.getByLabel('Project name').fill('Test Project');
    const goalSpecies = page.getByRole('textbox', { name: 'Species' });
    await goalSpecies.click();
    await goalSpecies.fill('Bulbasaur');
    const goalOption = page.locator('[role="option"]', { hasText: 'Bulbasaur' }).first();
    await goalOption.waitFor({ state: 'visible' });
    await goalOption.click();
    await page.getByRole('checkbox', { name: 'Target HP' }).check();
    await page.getByRole('checkbox', { name: 'Target Atk' }).check();
    await goalDialog.getByRole('button', { name: 'Create Project' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Open the project detail page.
    await page.getByText('Test Project').click();
    await expect(page.getByRole('heading', { name: 'Test Project' })).toBeVisible();
    const detailUrl = page.url();

    // Use the global header button to log a captured Pokémon.
    await page.getByTestId('global-add-pokemon').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const speciesInput = page.getByRole('textbox', { name: 'Species' });
    await speciesInput.click();
    await speciesInput.fill('Charmander');
    const option = page.locator('[role="option"]', { hasText: 'Charmander' }).first();
    await option.waitFor({ state: 'visible' });
    await option.click();
    await dialog.getByRole('button', { name: 'Add Pokémon' }).click();

    // Back on the same project detail page, with a confirmation toast.
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page).toHaveURL(detailUrl);
    await expect(page.getByText('Pokémon added')).toBeVisible();
  });
});
