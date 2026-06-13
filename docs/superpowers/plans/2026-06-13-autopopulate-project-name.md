# Auto-populate Project Name from Species — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the project modal, the target species is chosen first and selecting it pre-fills the (still freely editable) Project name with the species' display name.

**Architecture:** A single React component (`GoalForm.tsx`, using `@mantine/form`) holds the form. Add a `nameManuallyEdited` session flag; the species `onChange` handler regenerates the name from the selected species only while that flag is `false`. The name input's `onChange` sets the flag `true`. Reorder the JSX so the species selector renders above the name input. The flag resets each time the modal opens.

**Tech Stack:** React + TypeScript, `@mantine/core` / `@mantine/form`, Playwright (e2e), Vitest (unit), the project's data layer (`getSpeciesById`).

---

## File Structure

- **Modify:** `src/features/projects/GoalForm.tsx` — add `useState` import + `nameManuallyEdited` flag, regenerate name in `handleSpeciesChange`, wrap the name `TextInput` `onChange`, reset the flag in the open-effect, and reorder the species/name JSX. This is the only source file that changes.
- **Modify (test):** `e2e/projects.spec.ts` — add one Playwright test for the pre-fill behavior and field order. This is user-facing behavior, so e2e (not unit) is the correct layer per the project's testing policy.

No other files change. The species display name already comes from `getSpeciesById(id).name` (`src/data/index.ts`), already imported in `GoalForm.tsx`.

---

### Task 1: e2e test for species → name pre-fill

**Files:**
- Test: `e2e/projects.spec.ts` (add a new `test(...)` block; reuse existing top-of-file helpers `freshStart` and `selectOption`)

Context — existing helpers already in the file (do **not** re-add them):

```typescript
import { test, expect, type Page } from '@playwright/test';

async function freshStart(page: Page, hash = './#/projects') {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.goto(hash);
}

async function selectOption(page: Page, inputName: string, optionText: string) {
  const input = page.getByRole('textbox', { name: inputName });
  await input.click();
  await input.fill(optionText);
  const option = page.locator('[role="option"]', { hasText: optionText }).first();
  await option.waitFor({ state: 'visible' });
  await option.click();
}
```

Notes for the test author:
- A fresh start (cleared localStorage) shows the empty state, whose open button is **"Create your first project"** (the "New Project" button only appears once a project exists).
- The species combobox's accessible name contains "Species" (label is "Target species"), so `selectOption(page, 'Species', ...)` matches it. The name input's label is exactly "Project name".
- `'Bulbasaur'` and `'Charmander'` are species already used elsewhere in this spec — safe to reuse.

- [ ] **Step 1: Write the failing test**

Add this block at the end of `e2e/projects.spec.ts` (inside the same top-level `test.describe` if the file uses one; otherwise as a top-level `test`):

```typescript
test('project name pre-fills from species and respects manual edits', async ({ page }) => {
  await freshStart(page);

  // Open the new-project modal (empty state on a fresh start).
  await page.getByRole('button', { name: 'Create your first project' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  const nameInput = page.getByLabel('Project name');
  const speciesInput = page.getByRole('textbox', { name: 'Species' });

  // Field order: species selector renders above the name input.
  const speciesBox = await speciesInput.boundingBox();
  const nameBox = await nameInput.boundingBox();
  expect(speciesBox).not.toBeNull();
  expect(nameBox).not.toBeNull();
  expect(speciesBox!.y).toBeLessThan(nameBox!.y);

  // Selecting a species pre-fills the (empty) name.
  await selectOption(page, 'Species', 'Bulbasaur');
  await expect(nameInput).toHaveValue('Bulbasaur');

  // Re-selecting a different species regenerates the name (still untouched).
  await selectOption(page, 'Species', 'Charmander');
  await expect(nameInput).toHaveValue('Charmander');

  // After a manual edit, changing species leaves the name alone.
  await nameInput.fill('My custom build');
  await selectOption(page, 'Species', 'Bulbasaur');
  await expect(nameInput).toHaveValue('My custom build');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:e2e -- projects.spec.ts -g "pre-fills from species"`
Expected: FAIL. With the current code the name stays empty after selecting a species (the first `toHaveValue('Bulbasaur')` assertion fails), and/or the field-order assertion fails because the name input currently renders above the species selector.

- [ ] **Step 3: Commit the failing test**

```bash
git add e2e/projects.spec.ts
git commit -m "test: e2e for project-name pre-fill from species"
```

---

### Task 2: Implement pre-fill + field reorder

**Files:**
- Modify: `src/features/projects/GoalForm.tsx`

- [ ] **Step 1: Add `useState` to the React import**

Find (line 1):

```typescript
import { useEffect, useMemo } from 'react';
```

Replace with:

```typescript
import { useEffect, useMemo, useState } from 'react';
```

- [ ] **Step 2: Add the `nameManuallyEdited` flag**

Immediately after the `const form = useForm<FormValues>({ ... });` block (the `useForm` call that ends with the `validate` object), add:

```typescript
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
```

- [ ] **Step 3: Reset the flag when the modal opens**

Find the open-effect (around line 88):

```typescript
  useEffect(() => {
    if (!opened) return;
    if (editingId) {
```

Insert a reset line right after the `if (!opened) return;` guard so it reads:

```typescript
  useEffect(() => {
    if (!opened) return;
    setNameManuallyEdited(false);
    if (editingId) {
```

(The effect's existing dependency array `[opened, editingId]` and the `eslint-disable-next-line react-hooks/exhaustive-deps` stay unchanged.)

- [ ] **Step 4: Regenerate the name in `handleSpeciesChange`**

Find (around line 133):

```typescript
  function handleSpeciesChange(id: number) {
    const newSpecies = getSpeciesById(id);
    form.setValues({
      ...form.values,
      speciesId: id,
      ability: null,
      gender: null,
      eggMoves: [],
      requireHiddenAbility: false,
    });
    void newSpecies;
  }
```

Replace with:

```typescript
  function handleSpeciesChange(id: number) {
    const newSpecies = getSpeciesById(id);
    form.setValues({
      ...form.values,
      speciesId: id,
      ability: null,
      gender: null,
      eggMoves: [],
      requireHiddenAbility: false,
      name: nameManuallyEdited
        ? form.values.name
        : (newSpecies?.name ?? form.values.name),
    });
  }
```

(The leftover `void newSpecies;` line is removed because `newSpecies` is now used.)

- [ ] **Step 5: Track manual edits on the name input**

Find the Project name `TextInput` (around line 224):

```typescript
        <TextInput
          label="Project name"
          required
          placeholder="e.g. Garchomp attacker"
          {...form.getInputProps('name')}
        />
```

Replace with (spread first, then override `onChange` so it wins):

```typescript
        <TextInput
          label="Project name"
          required
          placeholder="e.g. Garchomp attacker"
          {...form.getInputProps('name')}
          onChange={(event) => {
            setNameManuallyEdited(true);
            form.setFieldValue('name', event.currentTarget.value);
          }}
        />
```

- [ ] **Step 6: Reorder — species selector above the name input**

Currently the name `TextInput` block (from Step 5) renders immediately before the `SpeciesSelect` block:

```typescript
        <SpeciesSelect
          value={form.values.speciesId}
          onChange={handleSpeciesChange}
          label="Target species"
          required
          error={form.errors.speciesId as string | undefined}
        />
```

Move the entire `SpeciesSelect` block so it appears **before** the Project name `TextInput` block. After this edit the order in the JSX is: `SpeciesSelect`, then the Project name `TextInput`, then the existing Target IVs / Nature / Ability / Gender fields (unchanged).

- [ ] **Step 7: Run the e2e test to verify it passes**

Run: `npm run test:e2e -- projects.spec.ts -g "pre-fills from species"`
Expected: PASS — name pre-fills to "Bulbasaur", regenerates to "Charmander", is preserved as "My custom build" after manual edit, and the species selector sits above the name input.

- [ ] **Step 8: Run the full project suite (regression gate)**

Run: `npm run test:e2e -- projects.spec.ts`
Expected: PASS — existing project tests still pass. (The existing `openGoalFormAndFill` helper fills the name before selecting the species; that manual fill sets `nameManuallyEdited = true`, so the subsequent species selection does not overwrite the typed name — no regression.)

- [ ] **Step 9: Typecheck and lint**

Run: `npx tsc -b && npx eslint .`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/features/projects/GoalForm.tsx
git commit -m "feat: pre-fill project name from selected species"
```

---

## Self-Review

**Spec coverage:**
- Field reorder (species first) → Task 2 Step 6 + test field-order assertion (Task 1). ✓
- `nameManuallyEdited` flag default `false` → Task 2 Step 2. ✓
- Regenerate name in species `onChange` only when flag `false` → Task 2 Step 4. ✓
- Name `onChange` sets flag `true` → Task 2 Step 5. ✓
- Regeneration only inside species `onChange`, never on mount; flag resets on open → Task 2 Step 3. ✓
- Create-mode behavior (fill, regenerate, then preserve) → covered by test assertions. ✓
- Edit-mode behavior (no change on open; regenerate-before-touch; preserve-after-touch) → flag reset on open (Step 3) + species handler (Step 4); accepted destructive-on-edit consequence is documented in the spec. ✓
- Testing via Playwright e2e with the four scenarios → Task 1. ✓

**Placeholder scan:** none — every code step shows full before/after code and exact commands.

**Type consistency:** `handleSpeciesChange(id: number)`, `getSpeciesById(id).name`, `form.setFieldValue('name', string)`, and `nameManuallyEdited: boolean` are consistent across tasks and match the verbatim signatures from the existing component.
