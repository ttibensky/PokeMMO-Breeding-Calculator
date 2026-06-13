# Nature Dropdown Stat-Change Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each nature's stat effect inside every nature dropdown option, e.g. `Adamant +Atk −SpA`, neutral natures as `Hardy neutral`.

**Architecture:** Add one shared formatter `formatNatureLabel(nature)` in `src/features/projects/projectHelpers.ts` (which already owns the canonical `STAT_LABELS` Record). It combines the existing `NATURE_EFFECT` (from `src/data/natures.ts`) with `STAT_LABELS`. The three nature `<Select>` components change only their option `label`; the option `value` stays the bare nature name, so stored data and value-based selection are unaffected.

**Tech Stack:** React + TypeScript, Mantine `<Select>`, Vitest (unit), Playwright (e2e).

> **Note on the minus sign:** the drop stat uses the U+2212 character `−` (NOT the ASCII hyphen `-`). Copy it exactly from this document.

---

### Task 1: Add the `formatNatureLabel` formatter

**Files:**
- Modify: `src/features/projects/projectHelpers.ts`
- Test: `src/features/projects/projectHelpers.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/features/projects/projectHelpers.test.ts`. If the file does not exist, create it with this exact content; if it already exists, append the `describe` block and add `formatNatureLabel` to the existing import from `./projectHelpers`.

```ts
import { describe, it, expect } from 'vitest';
import { formatNatureLabel } from './projectHelpers';

describe('formatNatureLabel', () => {
  it('formats an effect nature as "Name +Up −Down"', () => {
    expect(formatNatureLabel('Adamant')).toBe('Adamant +Atk −SpA');
  });

  it('formats another effect nature correctly', () => {
    expect(formatNatureLabel('Modest')).toBe('Modest +SpA −Atk');
  });

  it('formats a neutral nature as "Name neutral"', () => {
    expect(formatNatureLabel('Hardy')).toBe('Hardy neutral');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/features/projects/projectHelpers.test.ts`
Expected: FAIL — `formatNatureLabel` is not exported / not a function.

- [ ] **Step 3: Write minimal implementation**

In `src/features/projects/projectHelpers.ts`, add this import near the other imports at the top (after the existing `import type` lines):

```ts
import { NATURE_EFFECT } from '../../data/natures';
```

Then add the function below the existing `STAT_LABELS` definition:

```ts
export function formatNatureLabel(nature: string): string {
  const effect = NATURE_EFFECT[nature];
  if (!effect || effect.up === null || effect.down === null) {
    return `${nature} neutral`;
  }
  return `${nature} +${STAT_LABELS[effect.up]} −${STAT_LABELS[effect.down]}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/features/projects/projectHelpers.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/projects/projectHelpers.ts src/features/projects/projectHelpers.test.ts
git commit -m "feat: add formatNatureLabel helper for nature stat changes"
```

---

### Task 2: Use the formatter in GoalForm's nature select

**Files:**
- Modify: `src/features/projects/GoalForm.tsx:271-280` (the nature `<Select>`)
- Modify: `src/features/projects/GoalForm.tsx` import of `./projectHelpers`

- [ ] **Step 1: Add `formatNatureLabel` to the existing projectHelpers import**

Current (around line 17):

```ts
import { goalSummary } from './projectHelpers';
```

Change to:

```ts
import { goalSummary, formatNatureLabel } from './projectHelpers';
```

- [ ] **Step 2: Update the option label**

Current (lines 271-280):

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
```

Change the `data` line to:

```tsx
  data={NATURES.map((n) => ({ value: n, label: formatNatureLabel(n) }))}
```

(Leave the local `STAT_LABELS` in this file untouched — it is used elsewhere in the component.)

- [ ] **Step 3: Verify typecheck + existing unit tests pass**

Run: `npx tsc -b && npm run test:unit -- src/features/projects/GoalForm.test.tsx`
Expected: PASS (no type errors; the GoalForm test asserts the Nature textbox by aria-label, which is unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/features/projects/GoalForm.tsx
git commit -m "feat: show nature stat changes in goal form dropdown"
```

---

### Task 3: Use the formatter in ProjectDetailPage's baby-nature select

**Files:**
- Modify: `src/features/projects/ProjectDetailPage.tsx:384-392` (the baby-nature `<Select>`)
- Modify: `src/features/projects/ProjectDetailPage.tsx` import of `./projectHelpers`

- [ ] **Step 1: Add `formatNatureLabel` to the existing projectHelpers import**

The file already imports a block from `./projectHelpers`:

```ts
import {
  goalSummary,
  spentSoFar,
  progressPercent,
  STATUS_COLOR,
  STAT_LABELS,
  formatMoney,
  ITEM_LABELS,
} from './projectHelpers';
```

Add `formatNatureLabel` to that list:

```ts
import {
  goalSummary,
  spentSoFar,
  progressPercent,
  STATUS_COLOR,
  STAT_LABELS,
  formatMoney,
  ITEM_LABELS,
  formatNatureLabel,
} from './projectHelpers';
```

- [ ] **Step 2: Update the option label**

Current (lines 384-392):

```tsx
<Select
  label="Nature"
  data={NATURES.map((n) => ({ value: n, label: n }))}
  value={babyNature}
  onChange={(val) => val && setBabyNature(val)}
  searchable
  aria-label="Baby nature"
/>
```

Change the `data` line to:

```tsx
  data={NATURES.map((n) => ({ value: n, label: formatNatureLabel(n) }))}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npx tsc -b`
Expected: PASS (no type errors).

- [ ] **Step 4: Commit**

```bash
git add src/features/projects/ProjectDetailPage.tsx
git commit -m "feat: show nature stat changes in baby nature dropdown"
```

---

### Task 4: Use the formatter in OwnedPokemonForm's nature select

**Files:**
- Modify: `src/features/owned/OwnedPokemonForm.tsx:215-222` (the nature `<Select>`)
- Modify: `src/features/owned/OwnedPokemonForm.tsx` imports (add cross-feature import)

- [ ] **Step 1: Import the formatter**

Add this import alongside the other imports at the top of the file (after the `import { NATURES } from '../../data/natures';` line):

```ts
import { formatNatureLabel } from '../projects/projectHelpers';
```

(The file's local `STAT_LABELS` array stays untouched — it has a different shape and is used for IV inputs.)

- [ ] **Step 2: Update the option label**

Current (lines 215-222):

```tsx
<Select
  label="Nature"
  data={NATURES.map((n) => ({ value: n, label: n }))}
  value={form.values.nature}
  onChange={(val) => val && form.setFieldValue('nature', val)}
  searchable
  aria-label="Nature"
/>
```

Change the `data` line to:

```tsx
  data={NATURES.map((n) => ({ value: n, label: formatNatureLabel(n) }))}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npx tsc -b`
Expected: PASS (no type errors).

- [ ] **Step 4: Commit**

```bash
git add src/features/owned/OwnedPokemonForm.tsx
git commit -m "feat: show nature stat changes in owned pokemon dropdown"
```

---

### Task 5: E2E — confirm selection still works and assert the visible label

**Files:**
- Modify: `e2e/projects.spec.ts`

**Background:** The e2e helper `selectOption(page, 'Nature', 'Adamant')` fills the input with `Adamant` and clicks the `[role="option"]` whose text *contains* `Adamant`. Since the new label `Adamant +Atk −SpA` still contains `Adamant`, existing selection keeps working. The stored `value` is still the bare name, so downstream assertions on saved data are unaffected.

- [ ] **Step 1: Add an assertion that the option label includes the stat change**

In `e2e/projects.spec.ts`, inside an existing test that opens the goal form (where the Nature select is rendered), after the Nature input is opened, add an assertion that the Adamant option shows its stat changes. Concretely, add a focused test near the other goal-form tests:

```ts
test('nature dropdown options show stat changes', async ({ page }) => {
  await page.goto('/');
  // Open the goal form so the Nature select is visible.
  // Reuse the same navigation the other goal-form tests in this file use to
  // reach the form (e.g. create/open a project and open the add-goal modal).
  const natureInput = page.getByRole('textbox', { name: 'Nature' });
  await natureInput.click();
  await natureInput.fill('Adamant');
  const option = page.locator('[role="option"]', { hasText: 'Adamant +Atk −SpA' });
  await expect(option).toBeVisible();
});
```

If reaching the goal form requires setup steps already written as a helper in this spec file, call that helper to open the form before the `natureInput` lines above (do not duplicate the navigation logic — reuse the existing helper).

- [ ] **Step 2: Run the full e2e suite**

Run: `npm run test:e2e`
Expected: PASS — the new assertion passes and all pre-existing nature-selecting specs (projects + owned) still pass because they select by a substring of the label and read back the bare `value`.

- [ ] **Step 3: Commit**

```bash
git add e2e/projects.spec.ts
git commit -m "test: assert nature dropdown options show stat changes"
```

---

### Task 6: Full verification gate

- [ ] **Step 1: Run the complete suite**

Run: `npm run test:unit && npm run test:e2e && npx tsc -b && npx eslint .`
Expected: all green. If lint flags the U+2212 character or an unused import, fix it (remove genuinely unused imports introduced by these changes only) and re-run.

- [ ] **Step 2: Final commit (only if Step 1 required fixes)**

```bash
git add -A
git commit -m "chore: verification fixes for nature dropdown labels"
```
