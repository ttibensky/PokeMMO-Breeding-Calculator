# Goal Form "Any" Option Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit "Any nature" / "Any ability" item to the top of the goal form's nature and ability dropdowns so a user can re-select "any" directly from the open list (in addition to the existing ✕ clear button).

**Architecture:** Pure UI change in one file (`src/features/projects/GoalForm.tsx`). A stable sentinel value `'__ANY__'` represents the "Any" list item; selecting it maps the field back to `null` (the existing "no selection" state). No store-type or engine changes — the goal already encodes "any" as a missing value and the planner/cost code already treats a missing nature/ability as "matches anything".

**Tech Stack:** React + TypeScript, Mantine `<Select>`, `@mantine/form`, Playwright (e2e).

---

## Spec

`docs/superpowers/specs/2026-06-13-goal-form-any-option-design.md`

## File Structure

- **Modify:** `src/features/projects/GoalForm.tsx` — add the `ANY_VALUE` sentinel, prepend the "Any" item to each dropdown's `data`, and map the sentinel back to `null` in each `onChange`.
- **Modify (test):** `e2e/projects.spec.ts` — add one e2e test that selects a concrete nature/ability, then re-selects "Any …" and asserts the field reverts to the "any" state.

No new files. No unit test: the change is purely observable UI behavior, so it is covered by e2e per the project testing policy.

---

## Current code (verbatim, for reference)

The two Selects today (`GoalForm.tsx` ~271-291):

```tsx
<Select
  label="Nature (optional)"
  placeholder="Any nature"
  data={NATURES.map((n) => ({ value: n, label: n }))}
  value={form.values.nature}
  onChange={(val) => form.setFieldValue('nature', val)}
  searchable
  clearable
  aria-label="Nature"
/>

<Select
  label="Ability (optional)"
  placeholder="Any ability"
  data={abilityOptions.length > 0 ? abilityOptions : []}
  value={form.values.ability}
  onChange={(val) => form.setFieldValue('ability', val)}
  clearable
  disabled={abilityOptions.length === 0}
  aria-label="Ability"
/>
```

Ability options are built at ~122-123:

```tsx
const normalAbilityNames = species ? normalAbilities(species) : [];
const abilityOptions = normalAbilityNames.map((name) => ({ value: name, label: name }));
```

Form values type (`nature: string | null`, `ability: string | null`) and the submission mapping (`nature: values.nature ?? undefined`, `ability: values.ability ?? undefined`) are unchanged by this work.

---

## Task 1: Add explicit "Any" option to nature & ability dropdowns

**Files:**
- Modify: `src/features/projects/GoalForm.tsx` (sentinel const; nature Select `data` + `onChange`; ability `data` + Select `onChange`)
- Test: `e2e/projects.spec.ts` (add one test)

---

- [ ] **Step 1: Write the failing e2e test**

Add this test to `e2e/projects.spec.ts`. It uses the file's existing `openGoalFormAndFill`, `selectOption`, and `freshStart` helpers. Place it alongside the other goal-form tests (after the validation test).

```ts
test('lets you re-select "Any" for nature and ability after picking a value', async ({ page }) => {
  await freshStart(page);

  await openGoalFormAndFill(page, {
    trigger: 'emptyState',
    name: 'Any-reset goal',
    species: 'Bulbasaur',
    stats: ['Target HP', 'Target Atk'],
  });

  // --- Nature: pick a concrete value, then reset to "Any nature" ---
  const natureInput = page.getByRole('textbox', { name: 'Nature' });
  await selectOption(page, 'Nature', 'Adamant');
  await expect(natureInput).toHaveValue('Adamant');

  await selectOption(page, 'Nature', 'Any nature');
  await expect(natureInput).toHaveValue('');

  // --- Ability: pick a concrete value, then reset to "Any ability" ---
  // Bulbasaur's only normal ability is "Overgrow". Ability Select is not
  // searchable, so open it and click the option directly.
  const abilityInput = page.getByRole('textbox', { name: 'Ability' });

  await abilityInput.click();
  await page.locator('[role="option"]', { hasText: 'Overgrow' }).first().click();
  await expect(abilityInput).toHaveValue('Overgrow');

  await abilityInput.click();
  await page.locator('[role="option"]', { hasText: 'Any ability' }).first().click();
  await expect(abilityInput).toHaveValue('');
});
```

Note for the implementer: if the ability input is not reachable via `getByRole('textbox', { name: 'Ability' })` (Mantine renders a non-searchable Select input as read-only), fall back to `page.getByLabel('Ability')`. Confirm by running the test — do not guess silently.

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx playwright test e2e/projects.spec.ts -g "re-select"`
Expected: FAIL — selecting "Any nature"/"Any ability" finds no such option in the list (the item does not exist yet), so the option click or the `toHaveValue('')` assertion fails.

- [ ] **Step 3: Add the `ANY_VALUE` sentinel**

In `src/features/projects/GoalForm.tsx`, add a module-level constant near the top of the file (after the imports, before the component). The value must not collide with any real nature (none of the 25 `NATURES` entries) or ability name:

```tsx
const ANY_VALUE = '__ANY__';
```

- [ ] **Step 4: Update the nature Select**

Replace the nature `<Select>` (the block shown in "Current code") with:

```tsx
<Select
  label="Nature (optional)"
  placeholder="Any nature"
  data={[
    { value: ANY_VALUE, label: 'Any nature' },
    ...NATURES.map((n) => ({ value: n, label: n })),
  ]}
  value={form.values.nature}
  onChange={(val) => form.setFieldValue('nature', val === ANY_VALUE ? null : val)}
  searchable
  clearable
  aria-label="Nature"
/>
```

- [ ] **Step 5: Update the ability options and Select**

First, build an ability data array that prepends the "Any ability" item only when a species is selected (so the existing "disabled until species chosen" behavior is preserved). Add this just after the existing `abilityOptions` definition (~line 123):

```tsx
const abilityData =
  abilityOptions.length > 0
    ? [{ value: ANY_VALUE, label: 'Any ability' }, ...abilityOptions]
    : [];
```

Then replace the ability `<Select>` with:

```tsx
<Select
  label="Ability (optional)"
  placeholder="Any ability"
  data={abilityData}
  value={form.values.ability}
  onChange={(val) => form.setFieldValue('ability', val === ANY_VALUE ? null : val)}
  clearable
  disabled={abilityOptions.length === 0}
  aria-label="Ability"
/>
```

(`disabled` still keys off `abilityOptions.length`, not `abilityData`, so the control remains disabled until a species is chosen.)

- [ ] **Step 6: Run the test and verify it passes**

Run: `npx playwright test e2e/projects.spec.ts -g "re-select"`
Expected: PASS.

- [ ] **Step 7: Run the full verification suite**

```bash
npm run test:unit
npm run test:e2e
npm run typecheck
npm run lint
```
Expected: all green. (If a check was already red on this branch before the change, report it as pre-existing.)

- [ ] **Step 8: Commit**

```bash
git add src/features/projects/GoalForm.tsx e2e/projects.spec.ts
git commit -m "feat: add explicit 'Any' option to goal form nature/ability dropdowns"
```

---

## Self-review notes

- **Spec coverage:** "Any" item at top of both lists (Steps 4-5), selecting it returns field to `null`/placeholder (sentinel→null in `onChange`), ✕ clear button retained (`clearable` kept on both), e2e covers both fields (Step 1). All spec success criteria mapped.
- **Sentinel safety:** `'__ANY__'` is not in `NATURES` and is not an ability name; selecting it never persists (mapped to `null`), so `value` never equals the sentinel and the item only ever acts as a reset trigger.
- **Type consistency:** `form.values.nature`/`ability` stay `string | null`; `onChange` callback returns `string | null` to `setFieldValue`. Submission mapping (`?? undefined`) unchanged.
