import { test, expect, type Page } from '@playwright/test';

const MON_RESERVED = {
  id: 'mon-reserved', speciesId: 1,
  ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  nature: 'Hardy', ability: 'Overgrow', isHiddenAbility: false,
  gender: 'female', isShiny: false, isAlpha: false, eggMoves: [],
  createdAt: '2024-01-01T00:00:00.000Z',
};
const MON_FREE = {
  id: 'mon-free', speciesId: 4,
  ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  nature: 'Hardy', ability: 'Blaze', isHiddenAbility: false,
  gender: 'male', isShiny: false, isAlpha: false, eggMoves: [],
  createdAt: '2024-01-01T00:00:00.000Z',
};
const PROJECT_A = {
  id: 'pa', name: 'HP Atk', goal: { speciesId: 1, targetIVs: { hp: 31, atk: 31 } },
  status: 'in-progress', progress: [], createdAt: '2024-01-01T00:00:00.000Z',
};
const PROJECT_B = {
  id: 'pb', name: 'HP Def', goal: { speciesId: 1, targetIVs: { hp: 31, def: 31 } },
  status: 'in-progress', progress: [], createdAt: '2024-01-01T00:00:00.000Z',
};

async function seed(page: Page, state: { ownedPokemon: unknown[]; projects: unknown[] }) {
  await page.addInitScript((s) => {
    localStorage.setItem('pokemmo-breeding-store', JSON.stringify({ state: s, version: 0 }));
  }, state);
  await page.goto('/#/owned');
  await expect(page.getByTestId('owned-filter-bar')).toBeVisible();
}

async function pickReservation(page: Page, label: string) {
  const input = page.getByTestId('owned-filter-bar').getByRole('textbox', { name: 'Filter by reservation' });
  await input.click();
  const listboxId = await input.getAttribute('aria-controls');
  const option = page.locator(`#${listboxId} [role="option"]`, { hasText: label });
  await option.waitFor({ state: 'visible' });
  await option.click();
}

test('shows a Reserved badge on a mon an in-progress project needs, not on a free mon', async ({ page }) => {
  await seed(page, { ownedPokemon: [MON_RESERVED, MON_FREE], projects: [PROJECT_A] });
  await expect(page.getByTestId('owned-card-mon-reserved').getByText('Reserved')).toBeVisible();
  await expect(page.getByTestId('owned-card-mon-free').getByText(/Reserved/)).toHaveCount(0);
});

test('shows a conflict badge when two in-progress projects need the same mon', async ({ page }) => {
  await seed(page, { ownedPokemon: [MON_RESERVED], projects: [PROJECT_A, PROJECT_B] });
  await expect(page.getByTestId('owned-card-mon-reserved')).toContainText('Reserved ·2');
});

test('the reservation filter narrows the list', async ({ page }) => {
  await seed(page, { ownedPokemon: [MON_RESERVED, MON_FREE], projects: [PROJECT_A] });

  await pickReservation(page, 'Reserved');
  await expect(page.getByTestId('owned-card-mon-reserved')).toBeVisible();
  await expect(page.getByTestId('owned-card-mon-free')).toHaveCount(0);

  await pickReservation(page, 'Free to breed');
  await expect(page.getByTestId('owned-card-mon-free')).toBeVisible();
  await expect(page.getByTestId('owned-card-mon-reserved')).toHaveCount(0);

  await pickReservation(page, 'All');
  await expect(page.getByTestId('owned-card-mon-reserved')).toBeVisible();
  await expect(page.getByTestId('owned-card-mon-free')).toBeVisible();
});

test('deleting a reserved mon warns; deleting a free mon does not', async ({ page }) => {
  await seed(page, { ownedPokemon: [MON_RESERVED, MON_FREE], projects: [PROJECT_A] });

  // Reserved → warning, then confirm removes it.
  await page.getByRole('button', { name: 'Delete Bulbasaur' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Reserved by 1 in-progress project');
  await expect(dialog).toContainText('HP Atk');
  await dialog.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByTestId('owned-card-mon-reserved')).toHaveCount(0);

  // Free → no reservation warning.
  await page.getByRole('button', { name: 'Delete Charmander' }).click();
  const dialog2 = page.getByRole('dialog');
  await expect(dialog2).not.toContainText('Reserved by');
  await dialog2.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByTestId('owned-card-mon-free')).toHaveCount(0);
});
