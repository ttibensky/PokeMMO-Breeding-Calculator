# Remove Owned-page "Add Pokémon" Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant page-level "Add Pokémon" button from `OwnedPage` (now covered by the global header button), keeping the empty-state CTA and all add behavior intact.

**Architecture:** Delete the page-level button + its `Group` wrapper from `OwnedPage`, leaving just the title. `handleAdd` stays (still wired to the empty-state button via `OwnedPokemonList`'s `onAdd`). Two e2e helpers that resolve the "Add Pokémon" header button are made explicit via the global button's `data-testid`.

**Tech Stack:** React 18, React Router v6 (HashRouter), Mantine v7, Playwright (e2e), Vitest (unit).

**Spec:** `docs/superpowers/specs/2026-06-13-remove-owned-page-add-button-design.md`

---

## File Structure

- **Modify:** `src/features/owned/OwnedPage.tsx` — remove the page-level button + `Group`, trim imports.
- **Modify:** `e2e/owned.spec.ts` — add a guard test; repoint the `openAddForm` "header" branch to the global testid.
- **Modify:** `e2e/projects.spec.ts` — repoint the `openAddOwnedForm` "header" branch to the global testid.

Single task — the change is small and self-contained.

---

## Task 1: Remove the page-level "Add Pokémon" button

**Files:**
- Modify: `src/features/owned/OwnedPage.tsx` (imports line 2; header lines 53–56)
- Test: `e2e/owned.spec.ts` (helper lines 5–12; add one test)
- Test: `e2e/projects.spec.ts` (helper lines 26–33)

- [ ] **Step 1: Write the failing guard test**

In `e2e/owned.spec.ts`, add this test inside the existing `test.describe('Owned Pokémon page', ...)` block (the `beforeEach` already clears localStorage and navigates to `#/owned`):

```typescript
  // Guard: the page-level Add button is gone; only the global header button remains.
  test('has no page-level Add button — only the global header Add button', async ({ page }) => {
    await expect(page.getByTestId('global-add-pokemon')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Pokémon', exact: true })).toHaveCount(1);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:e2e -- owned.spec.ts -g "no page-level Add button"`
Expected: FAIL — currently two buttons have the exact name "Add Pokémon" (the global header button and the page-level one), so `toHaveCount(1)` sees 2.
NOTE: Playwright uses `npm run preview` on port 4173 with `reuseExistingServer`; if the suite can't connect, start `npm run preview &` first, wait until it responds, then run the e2e command.

- [ ] **Step 3: Remove the page-level button in `src/features/owned/OwnedPage.tsx`**

Change the import on line 2 from:

```tsx
import { Title, Button, Group } from '@mantine/core';
```

to:

```tsx
import { Title } from '@mantine/core';
```

Replace the header block (lines 53–56):

```tsx
      <Group justify="space-between" mb="md">
        <Title order={1}>Owned Pokémon</Title>
        <Button onClick={handleAdd}>Add Pokémon</Button>
      </Group>
```

with:

```tsx
      <Title order={1} mb="md">Owned Pokémon</Title>
```

Leave everything else unchanged. In particular, KEEP `handleAdd` (lines 23–26) — it is still passed as `onAdd` to `OwnedPokemonList` on line 58 for the empty-state button, so it is not orphaned. Do not touch `handleEdit`, `handleClose`, the `useEffect`, or the `?add=1`/`returnTo` logic.

- [ ] **Step 4: Make the e2e header helpers explicit (global testid)**

In `e2e/owned.spec.ts`, change the `openAddForm` helper (lines 5–12) "else" branch from:

```typescript
  } else {
    await page.getByRole('button', { name: 'Add Pokémon' }).first().click();
  }
```

to:

```typescript
  } else {
    await page.getByTestId('global-add-pokemon').click();
  }
```

In `e2e/projects.spec.ts`, change the `openAddOwnedForm` helper (lines 26–33) "else" branch identically:

```typescript
  } else {
    await page.getByTestId('global-add-pokemon').click();
  }
```

Rationale: previously `.first()` already resolved to the global header button (it renders before `<main>`), so behavior is unchanged — but using the `data-testid` is explicit and no longer depends on DOM order or the page-level button's absence.

- [ ] **Step 5: Run the guard test to verify it passes**

Run: `npm run test:e2e -- owned.spec.ts -g "no page-level Add button"`
Expected: PASS — exactly one "Add Pokémon" button (the global header one) remains.

- [ ] **Step 6: Full verification gate**

Run: `npm run typecheck && npm run lint && npm run test:unit && npm run test:e2e`
Expected: PASS across the board. Pay attention to `projects.spec.ts` "full breed report…" (which adds an owned Pokémon via `via: 'header'` — now using the global testid) and all of `owned.spec.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/features/owned/OwnedPage.tsx e2e/owned.spec.ts e2e/projects.spec.ts
git commit -m "feat: remove redundant page-level Add Pokémon button from Owned page"
```

---

## Done criteria

- The Owned page no longer renders its own header "Add Pokémon" button; the heading stands alone.
- Adding from a populated Owned list is done via the global header button; the empty-state "Add your first Pokémon" CTA is unchanged.
- `handleAdd` retained (empty-state button still works); no orphaned imports or handlers.
- `npm run typecheck && npm run lint && npm run test:unit && npm run test:e2e` all green.
