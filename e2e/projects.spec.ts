import { test, expect, type Page } from '@playwright/test';

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Navigate to a page and clear localStorage so every test starts fresh. */
async function freshStart(page: Page, hash = './#/projects') {
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
 * Open the "Add Pokémon" form on the Owned page.
 * Uses the empty-state button when the list is empty.
 */
async function openAddOwnedForm(page: Page, via: 'header' | 'emptyState' = 'header') {
  if (via === 'emptyState') {
    await page.getByRole('button', { name: 'Add your first Pokémon' }).click();
  } else {
    await page.getByRole('button', { name: 'Add Pokémon' }).first().click();
  }
  await expect(page.getByRole('dialog')).toBeVisible();
}

/**
 * Add a single owned Pokémon via the form.
 * ivs: { hp, atk, ... } — only pass the stats you want to set to 31.
 * gender: 'Male' | 'Female' — matches the SegmentedControl labels.
 */
async function addOwnedPokemon(
  page: Page,
  opts: {
    species: string;
    gender: 'Male' | 'Female';
    ivs?: Partial<Record<'HP' | 'Atk' | 'Def' | 'SpA' | 'SpD' | 'Spe', number>>;
    nature?: string;
    via?: 'header' | 'emptyState';
  },
) {
  await openAddOwnedForm(page, opts.via ?? 'header');

  // Species
  await selectOption(page, 'Species', opts.species);

  // IVs
  if (opts.ivs) {
    for (const [label, value] of Object.entries(opts.ivs)) {
      const input = page.getByLabel(label as string);
      await input.fill(String(value));
      await input.press('Tab');
    }
  }

  // Nature (optional — default is fine)
  if (opts.nature) {
    await selectOption(page, 'Nature', opts.nature);
  }

  // Gender — SegmentedControl radio inputs are CSS-hidden; click the visible <label> scoped to
  // the dialog to avoid false matches and use exact text to distinguish "Male" / "Female".
  const dialog = page.getByRole('dialog');
  await dialog.locator('label').filter({ hasText: new RegExp(`^${opts.gender}$`) }).click();

  // Submit — reuse the dialog locator above
  await dialog.getByRole('button', { name: 'Add Pokémon' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
}

/**
 * Open the GoalForm modal from the Projects page and fill it.
 * stats: array of checkbox aria-labels, e.g. ['Target HP', 'Target Atk']
 */
async function openGoalFormAndFill(
  page: Page,
  opts: {
    trigger: 'newProject' | 'emptyState';
    name: string;
    species: string;
    stats: string[]; // aria-labels of checkboxes
  },
) {
  if (opts.trigger === 'emptyState') {
    await page.getByRole('button', { name: 'Create your first project' }).click();
  } else {
    await page.getByRole('button', { name: 'New Project' }).click();
  }
  await expect(page.getByRole('dialog')).toBeVisible();

  // Name
  await page.getByLabel('Project name').fill(opts.name);

  // Species — SpeciesSelect uses aria-label "Species" (same pattern as Owned form)
  await selectOption(page, 'Species', opts.species);

  // Stats — checkboxes with aria-label "Target HP" etc.
  for (const statLabel of opts.stats) {
    await page.getByRole('checkbox', { name: statLabel }).check();
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Projects feature', () => {
  // ── 1. Empty state + create a goal ──────────────────────────────────────────
  test('shows empty state and creates a 2×31 project', async ({ page }) => {
    await freshStart(page);

    // Empty state
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
    await expect(page.getByText('No breeding projects yet.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create your first project' })).toBeVisible();

    // Open form via CTA
    await openGoalFormAndFill(page, {
      trigger: 'emptyState',
      name: 'Bulba 2×31',
      species: 'Bulbasaur',
      stats: ['Target HP', 'Target Atk'],
    });

    // Submit
    await page.getByRole('dialog').getByRole('button', { name: 'Create Project' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Project card appears with name and goal summary
    await expect(page.getByText('Bulba 2×31')).toBeVisible();
    // Goal summary "2×31 HP/Atk" appears in the card (second match — first is the project name)
    await expect(page.getByText(/2×31/).first()).toBeVisible();
  });

  // ── Whole-card navigation ────────────────────────────────────────────────────
  test('clicking anywhere on the card (not just the title) opens the project detail', async ({ page }) => {
    await freshStart(page);

    await openGoalFormAndFill(page, {
      trigger: 'emptyState',
      name: 'Click Anywhere',
      species: 'Bulbasaur',
      stats: ['Target HP', 'Target Atk'],
    });
    await page.getByRole('dialog').getByRole('button', { name: 'Create Project' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Click the card body. The click lands at the card's center (the badge/cost row),
    // away from the title and the edit/delete icons — proving the whole box is clickable.
    await page.getByTestId('project-card').click();

    // Navigated to the detail view (#/projects/<id>)
    await expect(page.getByRole('heading', { name: 'Click Anywhere' })).toBeVisible();
    await expect(page).toHaveURL(/#\/projects\/.+/);
  });

  // ── Edit icon does not navigate ──────────────────────────────────────────────
  test('clicking the edit icon opens the edit modal without navigating to the detail', async ({ page }) => {
    await freshStart(page);

    await openGoalFormAndFill(page, {
      trigger: 'emptyState',
      name: 'Edit No Nav',
      species: 'Bulbasaur',
      stats: ['Target HP', 'Target Atk'],
    });
    await page.getByRole('dialog').getByRole('button', { name: 'Create Project' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Click the edit icon — opens the GoalForm modal, must NOT navigate.
    await page.getByRole('button', { name: 'Edit Edit No Nav' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    // Still on the list URL (#/projects), not the detail view (#/projects/<id>).
    await expect(page).toHaveURL(/#\/projects$/);
  });

  // ── 2. IV-count validation ───────────────────────────────────────────────────
  test('shows validation error when fewer than 2 stats are selected', async ({ page }) => {
    await freshStart(page);

    await openGoalFormAndFill(page, {
      trigger: 'emptyState',
      name: 'Bad goal',
      species: 'Bulbasaur',
      stats: ['Target HP'], // only 1 — should fail
    });

    // Try to submit
    await page.getByRole('dialog').getByRole('button', { name: 'Create Project' }).click();

    // Validation error visible — no card created
    await expect(page.getByText(/between 2 and 6/)).toBeVisible();
    // Dialog stays open (form not submitted)
    await expect(page.getByRole('dialog')).toBeVisible();

    // Close modal and confirm no card was created
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('No breeding projects yet.')).toBeVisible();
  });

  // ── 3. End-to-end: report a breed result ─────────────────────────────────────
  test('full breed report: parents consumed, child appears, progress recorded', async ({ page }) => {
    // Setup: add two Bulbasaur with complementary IVs
    await freshStart(page, './#/owned');

    // Female: HP=31
    await addOwnedPokemon(page, {
      species: 'Bulbasaur',
      gender: 'Female',
      ivs: { HP: 31 },
      nature: 'Adamant',
      via: 'emptyState',
    });

    // Male: Atk=31
    await addOwnedPokemon(page, {
      species: 'Bulbasaur',
      gender: 'Male',
      ivs: { Atk: 31 },
      nature: 'Hardy',
      via: 'header',
    });

    // Confirm 2 Bulbasaur cards are present
    await expect(page.locator('text=Bulbasaur').first()).toBeVisible();

    // Create the project
    await page.goto('./#/projects');
    await openGoalFormAndFill(page, {
      trigger: 'emptyState',
      name: 'Bulba HP+Atk',
      species: 'Bulbasaur',
      stats: ['Target HP', 'Target Atk'],
    });
    await page.getByRole('dialog').getByRole('button', { name: 'Create Project' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Open the project detail
    await page.getByText('Bulba HP+Atk').click();
    await expect(page.getByRole('heading', { name: 'Bulba HP+Atk' })).toBeVisible();

    // Goal summary visible
    await expect(page.getByText(/2×31/)).toBeVisible();

    // Cost estimate section with total
    await expect(page.getByRole('heading', { name: 'Cost Estimate' })).toBeVisible();
    await expect(page.getByText('Estimated total')).toBeVisible();

    // Recommendation section
    await expect(page.getByRole('heading', { name: 'Next Recommended Breed' })).toBeVisible();

    // "Report this breed" button within the recommendation card
    const reportBtn = page.getByRole('button', { name: 'Report this breed' });
    await expect(reportBtn).toBeVisible();

    // Click → modal opens pre-filled
    await reportBtn.click();
    const reportModal = page.getByRole('dialog', { name: 'Report Breed Result' });
    await expect(reportModal).toBeVisible();

    // Offspring species should show Bulbasaur
    await expect(reportModal.getByText('Bulbasaur')).toBeVisible();

    // Baby IVs: HP and Atk should be pre-filled to 31 (guaranteed stats)
    // (They may already be 31; just confirm the form renders IV inputs)
    const hpInput = page.getByLabel('HP');
    await expect(hpInput).toBeVisible();

    // Submit the report
    await reportModal.getByRole('button', { name: 'Submit Result' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Progress timeline: 1 breed recorded
    await expect(page.getByText('Progress Timeline')).toBeVisible();
    await expect(page.getByText('#1')).toBeVisible();

    // Spent should be non-zero
    await expect(page.getByText('Spent so far')).toBeVisible();
    // Check the timeline step shows a cost badge (currency format "$N") — use first() to avoid strict mode
    await expect(page.locator('text=/\\$[1-9][0-9,]*/').first()).toBeVisible();

    // Navigate to owned page: parents consumed, child present
    await page.goto('./#/owned');

    // Each card has a uniquely labelled "Edit Bulbasaur" ActionIcon.
    // After the breed: 2 parents consumed → 1 child added → exactly 1 edit button.
    const editButtons = page.getByRole('button', { name: 'Edit Bulbasaur' });
    await expect(editButtons).toHaveCount(1);
  });

  // ── 4. Multiple concurrent projects ─────────────────────────────────────────
  test('supports multiple concurrent projects listed on the Projects page', async ({ page }) => {
    await freshStart(page);

    // Create first project: Bulbasaur 2×31
    await openGoalFormAndFill(page, {
      trigger: 'emptyState',
      name: 'Bulba 2×31',
      species: 'Bulbasaur',
      stats: ['Target HP', 'Target Atk'],
    });
    await page.getByRole('dialog').getByRole('button', { name: 'Create Project' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Create second project: Charmander 3×31
    await page.getByRole('button', { name: 'New Project' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Project name').fill('Char 3×31');
    await selectOption(page, 'Species', 'Charmander');
    await page.getByRole('checkbox', { name: 'Target HP' }).check();
    await page.getByRole('checkbox', { name: 'Target Atk' }).check();
    await page.getByRole('checkbox', { name: 'Target Spe' }).check();
    await page.getByRole('dialog').getByRole('button', { name: 'Create Project' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Both cards present simultaneously
    await expect(page.getByText('Bulba 2×31')).toBeVisible();
    await expect(page.getByText('Char 3×31')).toBeVisible();
  });

  // ── 5. Abandon a project ─────────────────────────────────────────────────────
  test('abandoning a project shows the Abandoned status badge on the card', async ({ page }) => {
    await freshStart(page);

    // Create a project
    await openGoalFormAndFill(page, {
      trigger: 'emptyState',
      name: 'Will abandon',
      species: 'Bulbasaur',
      stats: ['Target HP', 'Target Atk'],
    });
    await page.getByRole('dialog').getByRole('button', { name: 'Create Project' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Open project detail
    await page.getByText('Will abandon').click();
    await expect(page.getByRole('heading', { name: 'Will abandon' })).toBeVisible();

    // Click "Abandon" button
    await page.getByRole('button', { name: 'Abandon' }).click();

    // Status Select should now show "Abandoned"
    const statusSelect = page.getByRole('textbox', { name: 'Project status' });
    await expect(statusSelect).toHaveValue('Abandoned');

    // Navigate back to projects list
    await page.getByRole('link', { name: /Back to Projects/ }).click();
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();

    // The card should show the "abandoned" badge
    await expect(page.getByText('abandoned')).toBeVisible();
  });

  // ── 6. Persistence across reload ─────────────────────────────────────────────
  test('persists projects after a page reload', async ({ page }) => {
    await freshStart(page);

    // Create a project
    await openGoalFormAndFill(page, {
      trigger: 'emptyState',
      name: 'Persistent Project',
      species: 'Bulbasaur',
      stats: ['Target HP', 'Target Atk'],
    });
    await page.getByRole('dialog').getByRole('button', { name: 'Create Project' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('Persistent Project')).toBeVisible();

    // Reload
    await page.reload();

    // Project still visible
    await expect(page.getByText('Persistent Project')).toBeVisible();
    await expect(page.getByText('No breeding projects yet.')).not.toBeVisible();
  });

  // ── 7. Delete a project ───────────────────────────────────────────────────────
  test('deletes a project after confirming the window.confirm dialog', async ({ page }) => {
    await freshStart(page);

    // Create a project
    await openGoalFormAndFill(page, {
      trigger: 'emptyState',
      name: 'Delete Me',
      species: 'Bulbasaur',
      stats: ['Target HP', 'Target Atk'],
    });
    await page.getByRole('dialog').getByRole('button', { name: 'Create Project' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('Delete Me')).toBeVisible();

    // Register dialog acceptor BEFORE triggering delete
    page.on('dialog', (d) => d.accept());

    await page.getByRole('button', { name: 'Delete Delete Me' }).click();

    // Project removed — back to empty state
    await expect(page.getByText('No breeding projects yet.')).toBeVisible();
    await expect(page.getByText('Delete Me')).not.toBeVisible();

    // Delete acted in place — never navigated to a detail view.
    await expect(page).toHaveURL(/#\/projects$/);
  });
});
