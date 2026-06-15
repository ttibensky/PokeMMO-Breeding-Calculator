# Owned Card Click → Edit Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking anywhere on an owned pokemon card on the Owned page opens the edit modal, the same modal the ✏️ button already opens.

**Architecture:** Add an `onClick` to the per-pokemon `<Card>` in `OwnedPokemonList.tsx` that reuses the existing `onEdit(mon.id)` callback, plus a `cursor: pointer` style. The three in-card action buttons (✏️/⧉/🗑️) call `e.stopPropagation()` so they don't also trigger the card's edit click. No new state, props, or store changes.

**Tech Stack:** React + TypeScript, Mantine (`@mantine/core`), Zustand store, Playwright e2e, Vitest.

---

## File Structure

- **Modify:** `src/features/owned/OwnedPokemonList.tsx` — add card `onClick` + cursor style; add `e.stopPropagation()` to the three `ActionIcon` handlers.
- **Modify (test):** `e2e/owned.spec.ts` — add two e2e cases: card-body click opens edit; delete button does NOT open edit.

No other files change. `OwnedPage.tsx`, the Zustand store, and `OwnedPokemonForm.tsx` are untouched (`onEdit` → `handleEdit` already wires `editingId` + `formOpened`).

---

## Reference: current code (verbatim, for accurate edits)

`src/features/owned/OwnedPokemonList.tsx`:

Card opening tag (~line 222):
```jsx
<Card key={mon.id} data-testid={`owned-card-${mon.id}`} withBorder padding="sm" radius="md">
```

Action buttons block (~lines 257–280):
```jsx
<Group gap="xs" wrap="nowrap">
  <ActionIcon
    variant="subtle"
    aria-label={`Edit ${name}`}
    onClick={() => onEdit(mon.id)}
  >
    ✏️
  </ActionIcon>
  <ActionIcon
    variant="subtle"
    aria-label={`Duplicate ${name}`}
    onClick={() => onDuplicate(mon.id)}
  >
    ⧉
  </ActionIcon>
  <ActionIcon
    variant="subtle"
    color="red"
    aria-label={`Delete ${name}`}
    onClick={() => setConfirmId(mon.id)}
  >
    🗑️
  </ActionIcon>
</Group>
```

Component signature (~lines 51–57):
```tsx
interface OwnedPokemonListProps {
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export function OwnedPokemonList({ onAdd, onEdit, onDuplicate }: OwnedPokemonListProps) {
```

---

## Task 1: Write the failing e2e tests

**Files:**
- Modify: `e2e/owned.spec.ts`

Seeding pattern (already used in `e2e/pool-reservation.spec.ts`): pre-seed localStorage via `addInitScript`, key `'pokemmo-breeding-store'`, wrapper `{ state, version: 0 }`. A seeded pokemon with `speciesId: 1` renders as **Bulbasaur**, giving aria-labels `Edit Bulbasaur` / `Delete Bulbasaur` and card testid `owned-card-<id>`.

- [ ] **Step 1: Add the failing test block**

Append this `test.describe` block to `e2e/owned.spec.ts` (it brings its own self-contained `seed` helper and fixture so it doesn't depend on other blocks in the file). If `e2e/owned.spec.ts` already imports `type Page` from `@playwright/test`, reuse the existing import instead of duplicating it.

```typescript
test.describe('Owned card click opens edit modal', () => {
  const MON_CLICK = {
    id: 'mon-click',
    speciesId: 1,
    ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    nature: 'Hardy',
    ability: 'Overgrow',
    isHiddenAbility: false,
    gender: 'female',
    isShiny: false,
    isAlpha: false,
    eggMoves: [],
    createdAt: '2024-01-01T00:00:00.000Z',
  };

  async function seedOwned(page: Page) {
    await page.addInitScript((s) => {
      localStorage.setItem('pokemmo-breeding-store', JSON.stringify({ state: s, version: 0 }));
    }, { ownedPokemon: [MON_CLICK], projects: [] });
    await page.goto('/#/owned');
    await expect(page.getByTestId('owned-filter-bar')).toBeVisible();
  }

  test('clicking the card body opens the edit modal', async ({ page }) => {
    await seedOwned(page);

    // Click the card body (top-left region: sprite/name area, not the right-aligned action buttons).
    await page.getByTestId('owned-card-mon-click').click({ position: { x: 12, y: 12 } });

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Edit Pokémon')).toBeVisible();
  });

  test('clicking the delete button opens delete confirmation, not the edit modal', async ({ page }) => {
    await seedOwned(page);

    await page.getByRole('button', { name: 'Delete Bulbasaur' }).click();

    // The delete-confirmation dialog appears...
    await expect(page.getByText(/Remove Bulbasaur from your collection/)).toBeVisible();
    // ...and the edit modal did NOT open (its title is absent).
    await expect(page.getByText('Edit Pokémon')).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run the new tests to verify they FAIL**

The worktree e2e gotcha applies — use an explicit preview port (3001 + reuseExistingServer tests the wrong build). Build first, then run on a dedicated port:

Run:
```bash
npm run build && PREVIEW_PORT=3101 npx playwright test e2e/owned.spec.ts -g "Owned card click opens edit modal"
```
Expected: The "clicking the card body opens the edit modal" test FAILS (card has no `onClick` yet, so no dialog appears → timeout waiting for the dialog). The delete-isolation test may already pass (the card isn't clickable yet); that's fine — it locks in behavior for after the change.

- [ ] **Step 3: Commit the failing test**

```bash
git add e2e/owned.spec.ts
git commit -m "test(owned): e2e for card-click opens edit modal"
```

---

## Task 2: Implement card click-to-edit with button isolation

**Files:**
- Modify: `src/features/owned/OwnedPokemonList.tsx:222` (Card tag)
- Modify: `src/features/owned/OwnedPokemonList.tsx:257-280` (action buttons)

- [ ] **Step 1: Add `onClick` + `cursor: pointer` to the Card**

Replace the Card opening tag:
```jsx
<Card key={mon.id} data-testid={`owned-card-${mon.id}`} withBorder padding="sm" radius="md">
```
with:
```jsx
<Card
  key={mon.id}
  data-testid={`owned-card-${mon.id}`}
  withBorder
  padding="sm"
  radius="md"
  onClick={() => onEdit(mon.id)}
  style={{ cursor: 'pointer' }}
>
```

- [ ] **Step 2: Add `e.stopPropagation()` to the three action buttons**

Replace the action-buttons block with the version below. Each handler now takes the event and stops propagation before running, so clicking a button does not also fire the card's edit click:
```jsx
<Group gap="xs" wrap="nowrap">
  <ActionIcon
    variant="subtle"
    aria-label={`Edit ${name}`}
    onClick={(e) => {
      e.stopPropagation();
      onEdit(mon.id);
    }}
  >
    ✏️
  </ActionIcon>
  <ActionIcon
    variant="subtle"
    aria-label={`Duplicate ${name}`}
    onClick={(e) => {
      e.stopPropagation();
      onDuplicate(mon.id);
    }}
  >
    ⧉
  </ActionIcon>
  <ActionIcon
    variant="subtle"
    color="red"
    aria-label={`Delete ${name}`}
    onClick={(e) => {
      e.stopPropagation();
      setConfirmId(mon.id);
    }}
  >
    🗑️
  </ActionIcon>
</Group>
```

- [ ] **Step 3: Run the e2e tests to verify they PASS**

Run:
```bash
npm run build && PREVIEW_PORT=3101 npx playwright test e2e/owned.spec.ts -g "Owned card click opens edit modal"
```
Expected: BOTH tests PASS — card-body click opens "Edit Pokémon"; delete button opens "Remove Bulbasaur from your collection" and the edit modal does not appear.

- [ ] **Step 4: Commit**

```bash
git add src/features/owned/OwnedPokemonList.tsx
git commit -m "feat(owned): open edit modal on card click"
```

---

## Task 3: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Run the full Owned e2e spec** (regression — make sure existing edit/delete/add tests still pass with the new card handler)

Run:
```bash
npm run build && PREVIEW_PORT=3101 npx playwright test e2e/owned.spec.ts
```
Expected: PASS (all tests in the file).

- [ ] **Step 2: Typecheck and lint**

Run:
```bash
npx tsc -b && npx eslint .
```
Expected: no errors.

- [ ] **Step 3: Unit suite** (no unit logic changed, but confirm nothing regressed)

Run:
```bash
npm run test:unit
```
Expected: PASS.

---

## Self-Review Notes

- **Spec coverage:** card click→edit (Task 2 Step 1), cursor affordance (Task 2 Step 1), button isolation via stopPropagation (Task 2 Step 2), keep ✏️ button (unchanged — still present), mouse-only/no a11y (no `tabIndex`/`role` added). e2e for card-click + delete-isolation (Task 1). All spec items covered.
- **Out of scope honored:** no keyboard/focus handling; no changes to `OwnedPage`, store, or `OwnedPokemonForm`; duplicate/delete behaviors unchanged (only propagation touched).
- **Type consistency:** `onEdit`/`onDuplicate` are `(id: string) => void` props; `setConfirmId` is the existing local delete-confirm state setter — all reused, no new signatures.
