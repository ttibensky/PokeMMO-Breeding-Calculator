# Pool Reservation View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface reservation state on the owned-Pokémon list — a "Reserved" badge (conflict-highlighted), an `All / Reserved / Free` filter, and a manual-delete warning — all derived from the full-plan engine over in-progress projects.

**Architecture:** A pure `computeReservations(pool, projects, getSpecies)` derives an `ownedId → ProjectRef[]` map by calling `buildFullPlan` for each `in-progress` project and unioning `reservedOwnedIds`. A thin `useReservations()` hook memoizes it from the store. The owned list reads the map for badges, threads a `reservedIds` set into the existing `filterAndSortOwned`, and extends the existing delete `Modal`. No new persisted state, no new route.

**Tech Stack:** TypeScript, React, Mantine, Zustand; Vitest (`npm run test:unit`) for pure logic, Playwright (`npm run test:e2e`) for UI.

**Spec:** `docs/superpowers/specs/2026-06-15-pool-reservation-view-design.md`

---

## File Structure

- **Create** `src/features/owned/reservations.ts` — `ProjectRef` type, pure `computeReservations`, `useReservations` hook. One responsibility: derive reservation map.
- **Create** `src/features/owned/reservations.test.ts` — Vitest unit tests for `computeReservations`.
- **Modify** `src/features/owned/ownedFilters.ts` — add `reservation` dimension + `reservedIds` param to `filterAndSortOwned` (backward-compatible default).
- **Modify** `src/features/owned/ownedFilters.test.ts` — add reservation-filter unit tests.
- **Modify** `src/features/owned/OwnedPokemonList.tsx` — reservation badge (+ per-card `data-testid`), filter control, thread `reservedIds`, extend delete modal with the warning.
- **Create** `e2e/pool-reservation.spec.ts` — badge, filter, and delete-warning e2e.

---

## Reference: existing symbols (verbatim, do not redefine)

```ts
// src/engine/fullPlan.ts
export function buildFullPlan(pool: OwnedPokemon[], goal: BreedingGoal, getSpecies: (id: number) => PokemonSpecies | undefined): FullPlan;
// FullPlan.reservedOwnedIds: string[]

// src/store/types.ts
export type ProjectStatus = 'planning' | 'in-progress' | 'done' | 'abandoned';
export interface BreedingProject { id: string; name: string; goal: BreedingGoal; status: ProjectStatus; progress: BreedStepResult[]; createdAt: string; }

// src/features/owned/ownedFilters.ts (current)
export interface OwnedFilterCriteria { search: string; nature: string | null; ability: string | null; gender: Gender | null; eggGroup: string | null; shinyOnly: boolean; alphaOnly: boolean; sortKey: OwnedSortKey; sortDir: SortDir; }
export const DEFAULT_CRITERIA: OwnedFilterCriteria = { search: '', nature: null, ability: null, gender: null, eggGroup: null, shinyOnly: false, alphaOnly: false, sortKey: 'createdAt', sortDir: 'asc' };
export function filterAndSortOwned(list: OwnedPokemon[], c: OwnedFilterCriteria): OwnedPokemon[];

// imports used by the owned feature
import { useBreedingStore } from '../../store/index';
import { getSpeciesById } from '../../data/index';

// localStorage persist: key 'pokemmo-breeding-store', version 1 (src/store/index.ts:78)
// species 1 = Bulbasaur, 4 = Charmander (used for e2e card scoping)
```

---

### Task 1: Reservation derivation module

**Files:**
- Create: `src/features/owned/reservations.ts`
- Test: `src/features/owned/reservations.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/owned/reservations.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeReservations } from './reservations';
import type { OwnedPokemon, BreedingProject } from '../../store/types';
import type { PokemonSpecies } from '../../data/types';

let _id = 0;
const fid = () => `mon-${++_id}`;

function makeMon(o: Partial<OwnedPokemon> = {}): OwnedPokemon {
  return {
    id: fid(), speciesId: 1,
    ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    nature: 'Hardy', ability: 'Overgrow', isHiddenAbility: false,
    gender: 'female', isShiny: false, isAlpha: false, eggMoves: [],
    createdAt: '2024-01-01T00:00:00.000Z', ...o,
  };
}

function makeProject(o: Partial<BreedingProject> = {}): BreedingProject {
  return {
    id: `proj-${++_id}`, name: 'Project',
    goal: { speciesId: 1, targetIVs: {} }, status: 'in-progress',
    progress: [], createdAt: '2024-01-01T00:00:00.000Z', ...o,
  };
}

function makeSpecies(id: number, p: Partial<PokemonSpecies> = {}): PokemonSpecies {
  return {
    id, name: `Species${id}`, types: ['normal'], spriteUrl: '',
    eggGroups: ['monster'], genderRate: 4, isGenderless: false, femaleRatio: 0.5,
    abilities: [{ name: 'Overgrow', isHidden: false }], moves: [], ...p,
  };
}
const SPECIES: Record<number, PokemonSpecies> = { 1: makeSpecies(1) };
const getSpecies = (id: number): PokemonSpecies | undefined => SPECIES[id];

describe('computeReservations', () => {
  it('returns an empty map when there are no projects', () => {
    const mon = makeMon({ ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
    expect(computeReservations([mon], [], getSpecies)).toEqual({});
  });

  it('maps an owned mon to the in-progress project whose plan reserves it', () => {
    const mon = makeMon({ ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
    const proj = makeProject({ id: 'p1', name: 'HP/Atk', goal: { speciesId: 1, targetIVs: { hp: 31, atk: 31 } }, status: 'in-progress' });
    const map = computeReservations([mon], [proj], getSpecies);
    expect(map[mon.id]).toEqual([{ projectId: 'p1', projectName: 'HP/Atk' }]);
  });

  it('flags a conflict when two in-progress projects reserve the same mon', () => {
    const mon = makeMon({ ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
    const a = makeProject({ id: 'a', name: 'A', goal: { speciesId: 1, targetIVs: { hp: 31, atk: 31 } } });
    const b = makeProject({ id: 'b', name: 'B', goal: { speciesId: 1, targetIVs: { hp: 31, def: 31 } } });
    const map = computeReservations([mon], [a, b], getSpecies);
    expect(map[mon.id]).toHaveLength(2);
    expect(map[mon.id].map((r) => r.projectId).sort()).toEqual(['a', 'b']);
  });

  it('ignores planning, done, and abandoned projects', () => {
    const mon = makeMon({ ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
    const goal = { speciesId: 1, targetIVs: { hp: 31, atk: 31 } };
    for (const status of ['planning', 'done', 'abandoned'] as const) {
      expect(computeReservations([mon], [makeProject({ goal, status })], getSpecies)).toEqual({});
    }
  });

  it('does not list a mon that no plan reserves', () => {
    const free = makeMon({ ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
    const proj = makeProject({ goal: { speciesId: 1, targetIVs: { hp: 31, atk: 31 } }, status: 'in-progress' });
    const map = computeReservations([free], [proj], getSpecies);
    expect(map[free.id]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/owned/reservations.test.ts`
Expected: FAIL — `computeReservations` not found / module missing.

- [ ] **Step 3: Write the implementation**

Create `src/features/owned/reservations.ts`:

```ts
import { useMemo } from 'react';
import { useBreedingStore } from '../../store/index';
import { getSpeciesById } from '../../data/index';
import { buildFullPlan } from '../../engine/fullPlan';
import type { OwnedPokemon, BreedingProject } from '../../store/types';
import type { PokemonSpecies } from '../../data/types';

export interface ProjectRef {
  projectId: string;
  projectName: string;
}

/** Map each owned mon to the in-progress projects whose plan reserves it. */
export function computeReservations(
  pool: OwnedPokemon[],
  projects: BreedingProject[],
  getSpecies: (id: number) => PokemonSpecies | undefined,
): Record<string, ProjectRef[]> {
  const map: Record<string, ProjectRef[]> = {};
  for (const p of projects) {
    if (p.status !== 'in-progress') continue;
    const { reservedOwnedIds } = buildFullPlan(pool, p.goal, getSpecies);
    for (const id of reservedOwnedIds) {
      (map[id] ??= []).push({ projectId: p.id, projectName: p.name });
    }
  }
  return map;
}

/** Store-wired reservation map, recomputed only when pool or projects change. */
export function useReservations(): Record<string, ProjectRef[]> {
  const pool = useBreedingStore((s) => s.ownedPokemon);
  const projects = useBreedingStore((s) => s.projects);
  return useMemo(() => computeReservations(pool, projects, getSpeciesById), [pool, projects]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/owned/reservations.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/owned/reservations.ts src/features/owned/reservations.test.ts
git commit -m "feat(owned): derive reservation map from in-progress project plans

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Reservation filter dimension

**Files:**
- Modify: `src/features/owned/ownedFilters.ts`
- Test: `src/features/owned/ownedFilters.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/features/owned/ownedFilters.test.ts` (reuse the file's existing mon factory if it has one; otherwise this self-contained block works):

```ts
import { filterAndSortOwned, DEFAULT_CRITERIA } from './ownedFilters';
import type { OwnedPokemon } from '../../store/types';

function rmon(id: string): OwnedPokemon {
  return {
    id, speciesId: 1, ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    nature: 'Hardy', ability: 'Overgrow', isHiddenAbility: false,
    gender: 'female', isShiny: false, isAlpha: false, eggMoves: [],
    createdAt: '2024-01-01T00:00:00.000Z',
  };
}

describe('filterAndSortOwned — reservation filter', () => {
  const reserved = rmon('r');
  const free = rmon('f');
  const reservedIds = new Set(['r']);

  it("'all' keeps both", () => {
    const out = filterAndSortOwned([reserved, free], { ...DEFAULT_CRITERIA, reservation: 'all' }, reservedIds);
    expect(out.map((m) => m.id).sort()).toEqual(['f', 'r']);
  });

  it("'reserved' keeps only the reserved mon", () => {
    const out = filterAndSortOwned([reserved, free], { ...DEFAULT_CRITERIA, reservation: 'reserved' }, reservedIds);
    expect(out.map((m) => m.id)).toEqual(['r']);
  });

  it("'free' keeps only the free mon", () => {
    const out = filterAndSortOwned([reserved, free], { ...DEFAULT_CRITERIA, reservation: 'free' }, reservedIds);
    expect(out.map((m) => m.id)).toEqual(['f']);
  });

  it('treats every mon as free when reservedIds is omitted', () => {
    const out = filterAndSortOwned([reserved, free], { ...DEFAULT_CRITERIA, reservation: 'free' });
    expect(out.map((m) => m.id).sort()).toEqual(['f', 'r']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/owned/ownedFilters.test.ts`
Expected: FAIL — `reservation` not on `OwnedFilterCriteria` (type error) and/or `filterAndSortOwned` ignores the third arg.

- [ ] **Step 3: Write the implementation**

In `src/features/owned/ownedFilters.ts`:

(a) Add `reservation` to the interface (after `alphaOnly`):

```ts
  alphaOnly: boolean;
  reservation: 'all' | 'reserved' | 'free';
```

(b) Add the default (after `alphaOnly: false,`):

```ts
  alphaOnly: false,
  reservation: 'all',
```

(c) Change the function signature to accept `reservedIds` (default empty for backward compatibility):

```ts
export function filterAndSortOwned(
  list: OwnedPokemon[],
  c: OwnedFilterCriteria,
  reservedIds: Set<string> = new Set(),
): OwnedPokemon[] {
```

(d) Inside the `list.filter((mon) => { ... })` predicate, add these two lines immediately after the `if (c.alphaOnly && !mon.isAlpha) return false;` line and before `return true;`:

```ts
    if (c.reservation === 'reserved' && !reservedIds.has(mon.id)) return false;
    if (c.reservation === 'free' && reservedIds.has(mon.id)) return false;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/owned/ownedFilters.test.ts`
Expected: PASS (existing tests + 4 new reservation tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/owned/ownedFilters.ts src/features/owned/ownedFilters.test.ts
git commit -m "feat(owned): add reserved/free filter dimension

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Owned-list UI — badge, filter control, delete warning

**Files:**
- Modify: `src/features/owned/OwnedPokemonList.tsx`

No unit test here — this is rendering/interaction behavior, covered by the e2e in Task 4 (per the testing-conventions rule, user-facing behavior is tested with Playwright).

- [ ] **Step 1: Add imports**

At the top of `src/features/owned/OwnedPokemonList.tsx`:
- Ensure `useMemo` is imported from `react` (add it to the existing `react` import alongside `useState`).
- Ensure `Tooltip` is imported from `@mantine/core` (add to the existing `@mantine/core` import).
- Add: `import { useReservations, type ProjectRef } from './reservations';`

- [ ] **Step 2: Add a local reservation-badge component**

Add this small component near the top of the file (module scope, below imports, above `OwnedPokemonList`):

```tsx
function ReservationBadge({ refs }: { refs?: ProjectRef[] }) {
  if (!refs || refs.length === 0) return null;
  if (refs.length === 1) {
    return (
      <Tooltip label={`Reserved by ${refs[0].projectName}`}>
        <Badge size="xs" variant="light" color="blue">Reserved</Badge>
      </Tooltip>
    );
  }
  return (
    <Tooltip label={`Reserved by: ${refs.map((r) => r.projectName).join(', ')}`}>
      <Badge size="xs" color="red">{`Reserved ·${refs.length} ⚠`}</Badge>
    </Tooltip>
  );
}
```

- [ ] **Step 3: Wire the hook, reserved set, and filtered list**

Inside `OwnedPokemonList`, after the existing `const [criteria, setCriteria] = useState<OwnedFilterCriteria>(DEFAULT_CRITERIA);` line, add:

```tsx
  const reservations = useReservations();
  const reservedIds = useMemo(() => new Set(Object.keys(reservations)), [reservations]);
```

Then find the existing call `filterAndSortOwned(ownedPokemon, criteria)` and add the third argument:

```tsx
  const filtered = filterAndSortOwned(ownedPokemon, criteria, reservedIds);
```

(If the existing variable name is not `filtered`, keep whatever name is there — only add the `, reservedIds` argument.)

- [ ] **Step 4: Add the reservation filter control**

Inside the `<Group data-testid="owned-filter-bar" ...>` block, add this control alongside the other selects (e.g. right after the gender `<Select ...>`):

```tsx
        <Select
          aria-label="Filter by reservation"
          data-testid="filter-reservation"
          value={criteria.reservation}
          onChange={(v) =>
            setCriteria((prev) => ({
              ...prev,
              reservation: (v as OwnedFilterCriteria['reservation']) ?? 'all',
            }))
          }
          data={[
            { value: 'all', label: 'All' },
            { value: 'reserved', label: 'Reserved' },
            { value: 'free', label: 'Free to breed' },
          ]}
        />
```

- [ ] **Step 5: Add the badge + per-card testid**

On the `<Card key={mon.id} ...>` element, add a test id attribute:

```tsx
        <Card key={mon.id} data-testid={`owned-card-${mon.id}`} withBorder padding="sm" radius="md">
```

In the first badge row (the `<Group gap="xs" wrap="wrap">` containing the Shiny/Alpha badges), add the reservation badge after the Alpha badge:

```tsx
          <ReservationBadge refs={reservations[mon.id]} />
```

- [ ] **Step 6: Extend the delete modal with the reservation warning**

Where the delete `<Modal>` renders (driven by `confirmId`), compute the confirming mon's reservations and show a warning line. Add, near where `confirmingName` is computed:

```tsx
  const confirmingRefs: ProjectRef[] | undefined = confirmId ? reservations[confirmId] : undefined;
```

Inside the `<Modal ...>` body, immediately before the existing `<Text size="sm" mb="md">Remove {confirmingName}...</Text>`, add:

```tsx
        {confirmingRefs && confirmingRefs.length > 0 && (
          <Text size="sm" c="red" mb="md">
            Reserved by {confirmingRefs.length} in-progress project
            {confirmingRefs.length > 1 ? 's' : ''}: {confirmingRefs.map((r) => r.projectName).join(', ')}.
          </Text>
        )}
```

(The existing "This cannot be undone." text and the Cancel/Remove buttons stay as-is — this only adds a warning line; deletion still proceeds on confirm.)

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b`
Expected: PASS. (If a literal `OwnedFilterCriteria` object elsewhere now errors for a missing `reservation` field, add `reservation: 'all'` to it.)

- [ ] **Step 8: Commit**

```bash
git add src/features/owned/OwnedPokemonList.tsx
git commit -m "feat(owned): show reservation badges, filter, and delete warning

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: e2e — badge, filter, delete warning

**Files:**
- Create: `e2e/pool-reservation.spec.ts`

Reservation data is derived: seed two owned mons and in-progress project(s) whose plan reserves the first mon. Species 1 = Bulbasaur (reserved), 4 = Charmander (free) — distinct names so delete buttons (`Delete <name>`) and cards are unambiguous.

- [ ] **Step 1: Write the e2e spec**

Create `e2e/pool-reservation.spec.ts`:

```ts
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
  await page.goto('/#/owned');
  await page.evaluate((s) => {
    localStorage.setItem('pokemmo-breeding-store', JSON.stringify({ state: s, version: 1 }));
  }, state);
  await page.reload();
  await expect(page.getByTestId('owned-filter-bar')).toBeVisible();
}

async function pickReservation(page: Page, label: string) {
  const input = page.getByTestId('owned-filter-bar').getByRole('textbox', { name: 'Filter by reservation' });
  await input.click();
  const option = page.locator('[role="option"]', { hasText: label }).first();
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
```

- [ ] **Step 2: Run the e2e spec**

In a worktree, install deps and use a unique preview port to avoid testing a stale build on the default port (see `.claude/rules/worktree-*` and memory):

Run:
```bash
npm install
PREVIEW_PORT=3210 npx playwright test pool-reservation.spec.ts
```
Expected: PASS (4 tests). If species 1/4 names differ in the dataset, adjust the `Delete <name>` selectors to the actual species names.

- [ ] **Step 3: Commit**

```bash
git add e2e/pool-reservation.spec.ts
git commit -m "test(owned): e2e for reservation badge, filter, and delete warning

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Full verification gate

**Files:** none (verification only).

- [ ] **Step 1: Unit tests** — Run: `npm run test:unit` → Expected: PASS (full suite, including `reservations.test.ts` + `ownedFilters.test.ts`).
- [ ] **Step 2: Typecheck** — Run: `npx tsc -b` → Expected: PASS.
- [ ] **Step 3: Lint** — Run: `npx eslint .` → Expected: PASS (no unused imports in `OwnedPokemonList.tsx` — `useMemo`, `Tooltip`, `useReservations`, `ProjectRef` are all used).
- [ ] **Step 4: e2e** — Run: `npm install && PREVIEW_PORT=3210 npx playwright test pool-reservation.spec.ts` → Expected: PASS (4 tests). Also run the existing owned suite to confirm no regression: `PREVIEW_PORT=3210 npx playwright test owned.spec.ts`.

---

## Self-Review

**Spec coverage:**
- Derived map from in-progress projects (`computeReservations` + `useReservations`) → Task 1. ✓
- Badge: neutral for 1 project, conflict (red `Reserved ·N ⚠`) for 2+ → Task 3 (`ReservationBadge`) + Task 4 tests. ✓
- `All / Reserved / Free` filter, default `all`, threaded via `reservedIds` → Task 2 + Task 3 control + Task 4 test. ✓
- Manual-delete warning (warn, not block), only for reserved mons, only the owned-list delete button → Task 3 Step 6 + Task 4 test. ✓
- Derived only, no persisted state, no new route → no store/router changes anywhere. ✓
- in-progress only (planning/done/abandoned ignored) → Task 1 (`status !== 'in-progress'`) + unit test. ✓
- Unit for pure logic, e2e for UI → Tasks 1–2 unit, Task 4 e2e. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every command has expected output. The only conditional instructions ("if the existing variable name is not `filtered`", "if species names differ") are robustness notes around verbatim edits, not missing content. ✓

**Type consistency:** `ProjectRef { projectId, projectName }` defined in Task 1, used identically in Tasks 3–4. `OwnedFilterCriteria.reservation: 'all' | 'reserved' | 'free'` defined in Task 2, used in Task 3's control and `DEFAULT_CRITERIA`. `filterAndSortOwned(list, c, reservedIds?)` signature consistent across Tasks 2–3. `computeReservations(pool, projects, getSpecies)` signature consistent between Task 1 impl and the `useReservations` caller. ✓
