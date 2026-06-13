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
