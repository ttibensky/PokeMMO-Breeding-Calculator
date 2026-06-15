import { test, expect } from '@playwright/test';

const VALID_CSV = `species,ivs,nature,gender
Bulbasaur,31/31/31/31/31/31,Modest,male
Charmander,31/0/31/31/31/31,Adamant,male`;

const BAD_CSV = `species,ivs
Notapokemon,31/31/31/31/31/31`;

test('bulk import commits a valid CSV to the pool', async ({ page }) => {
  await page.goto('./#/owned');
  await page.getByTestId('owned-bulk-add').click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByTestId('bulk-import-textarea').fill(VALID_CSV);

  const commit = dialog.getByTestId('bulk-import-commit');
  await expect(commit).toBeEnabled();
  await expect(commit).toHaveText(/Add 2 Pokémon/);
  await commit.click();

  // Modal closes; both species appear in the pool.
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Bulbasaur')).toBeVisible();
  await expect(page.getByText('Charmander')).toBeVisible();
});

test('bulk import blocks commit when a row is invalid', async ({ page }) => {
  await page.goto('./#/owned');
  await page.getByTestId('owned-bulk-add').click();

  const dialog = page.getByRole('dialog');
  await dialog.getByTestId('bulk-import-textarea').fill(BAD_CSV);

  await expect(dialog.getByTestId('bulk-import-row-error')).toBeVisible();
  await expect(dialog.getByTestId('bulk-import-commit')).toBeDisabled();
});
