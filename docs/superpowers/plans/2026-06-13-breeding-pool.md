# Breeding Pool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only "Breeding Pool" section to the project detail page that shows, per target attribute, which owned Pokémon are usable carriers (gaps flagged), plus an expandable list of egg-group-compatible species to acquire.

**Architecture:** Two pure engine functions in a new `src/engine/compatiblePool.ts` (reusing the planner's egg-group predicate), consumed by one new presentational component `BreedingPoolSection.tsx` that reads the Zustand store + species data and runs the functions in `useMemo`. No new store state, no persistence. Honors the PokeMMO mechanic that offspring take the mother's species: a different-species contributor must be **male or Ditto**.

**Tech Stack:** React 18 + TypeScript, Mantine v7 UI, Zustand store, Vitest (unit), Playwright (e2e).

---

## Reference facts (verified from the codebase)

- `src/data/index.ts`: `DITTO_ID = 132`; `allSpecies: PokemonSpecies[]`; `getSpeciesById(id): PokemonSpecies | undefined`.
- `src/data/types.ts:10-21` `PokemonSpecies`: `{ id, name, types, spriteUrl, eggGroups: string[], genderRate, isGenderless, femaleRatio, abilities, moves }`.
- `src/store/types.ts`: `StatKey = 'hp'|'atk'|'def'|'spa'|'spd'|'spe'`; `IVs = Record<StatKey, number>`; `Gender = 'male'|'female'|'genderless'`; `BreedingGoal { speciesId; targetIVs: Partial<Record<StatKey,31>>; nature?; ability?; requireHiddenAbility?; gender?; requireShiny?; eggMoves? }`; `OwnedPokemon { id; speciesId; ivs; nature; gender; ... }`.
- `src/engine/types.ts:3-5` `Attribute = { kind: 'iv'; stat: StatKey } | { kind: 'nature'; nature: string }`.
- `src/engine/planner.ts:148-159` `isCompatible(mon, goal, getSpecies)`: true if same species id, or Ditto, or shares an egg group. `src/engine/planner.ts:165-173` `carriesAttribute(mon, attr)`: iv → `mon.ivs[attr.stat] === 31`; nature → `mon.nature === attr.nature`.
- Egg-group strings are lowercase; the no-breed group is exactly `'no-eggs'`; only Ditto has group `'ditto'`.
- `src/features/projects/projectHelpers.ts:4-11` exports `STAT_LABELS: Record<StatKey, string>` (`hp→'HP'`, `atk→'Atk'`, `def→'Def'`, `spa→'SpA'`, `spd→'SpD'`, `spe→'Spe'`).
- UI: `useBreedingStore((s) => s.ownedPokemon)`; reusable `PokemonAvatar` (`src/components/PokemonAvatar.tsx`, props `speciesId: number; size?: number; showName?: boolean`); no Accordion in codebase — use a `useState` toggle.
- `ProjectDetailPage.tsx`: project name heading is `<Title order={2}>{project.name}</Title>` (line 540); insertion point is between the Recommendation card's `</Card>` (line 747) and the Cost Estimate card (line 749); `project` and `ownedPokemon` are already in scope.
- Test fixture pattern: `makeMon`, `makeSpecies`, `makeGetSpecies` (see `src/engine/validation.test.ts:1-80`). npm scripts: `npm run test:unit` (`vitest run`), `npm run test:e2e` (`playwright test`), `npm run lint` (`eslint .`), `npm run typecheck` (`tsc -b`).
- E2E helpers in `e2e/projects.spec.ts`: `freshStart(page)`, `openGoalFormAndFill(page, { trigger, name, species, stats })`; navigate to detail via `page.getByText(name).click()`.

---

## File Structure

- **Create** `src/engine/compatiblePool.ts` — two pure functions + small local helpers and the `AttributeCoverage` type.
- **Create** `src/engine/compatiblePool.test.ts` — Vitest units for both functions.
- **Modify** `src/engine/planner.ts` — extract `sharesEggGroup` helper; have `isCompatible` delegate to it; export it (DRY, no behavior change).
- **Modify** `src/engine/index.ts` — re-export the new engine functions (match existing barrel pattern).
- **Create** `src/features/projects/BreedingPoolSection.tsx` — the UI section.
- **Modify** `src/features/projects/ProjectDetailPage.tsx` — import and render `<BreedingPoolSection>`.
- **Modify** `e2e/projects.spec.ts` — add one e2e covering the section.

---

## Task 1: Extract `sharesEggGroup` in the planner (DRY refactor, no behavior change)

**Files:**
- Modify: `src/engine/planner.ts:148-159`

- [ ] **Step 1: Add the helper and delegate from `isCompatible`**

In `src/engine/planner.ts`, add `sharesEggGroup` immediately above `isCompatible`, and rewrite the egg-group line of `isCompatible` to call it. Final state of both functions:

```typescript
export function sharesEggGroup(a: PokemonSpecies, b: PokemonSpecies): boolean {
  return a.eggGroups.some((g) => b.eggGroups.includes(g));
}

export function isCompatible(
  mon: OwnedPokemon,
  goal: BreedingGoal,
  getSpecies: (id: number) => PokemonSpecies | undefined,
): boolean {
  if (mon.speciesId === goal.speciesId) return true;
  if (mon.speciesId === DITTO_ID) return true;
  const monSpecies = getSpecies(mon.speciesId);
  const targetSpecies = getSpecies(goal.speciesId);
  if (!monSpecies || !targetSpecies) return false;
  return sharesEggGroup(monSpecies, targetSpecies);
}
```

- [ ] **Step 2: Run the existing unit suite to confirm no regression**

Run: `npm run test:unit`
Expected: PASS — the refactor is behavior-preserving and existing planner/validation tests stay green.

- [ ] **Step 3: Commit**

```bash
git add src/engine/planner.ts
git commit -m "refactor: extract sharesEggGroup predicate in planner"
```

---

## Task 2: `getCompatibleSpecies` engine function

**Files:**
- Create: `src/engine/compatiblePool.ts`
- Test: `src/engine/compatiblePool.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/engine/compatiblePool.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getCompatibleSpecies } from './compatiblePool';
import type { PokemonSpecies } from '../data/types';

function makeSpecies(overrides?: Partial<PokemonSpecies>): PokemonSpecies {
  return {
    id: 1,
    name: 'Bulbasaur',
    types: ['Grass'],
    spriteUrl: '',
    eggGroups: ['monster', 'plant'],
    genderRate: 7,
    isGenderless: false,
    femaleRatio: 0.125,
    abilities: [],
    moves: [],
    ...overrides,
  };
}

const BULBASAUR = makeSpecies({ id: 1, name: 'Bulbasaur', eggGroups: ['monster', 'plant'] });
const CHARMANDER = makeSpecies({ id: 4, name: 'Charmander', eggGroups: ['monster', 'dragon'] });
const GASTLY = makeSpecies({ id: 92, name: 'Gastly', eggGroups: ['amorphous'] });
const MEWTWO = makeSpecies({ id: 150, name: 'Mewtwo', eggGroups: ['no-eggs'], isGenderless: true });
const MAGNEMITE = makeSpecies({ id: 81, name: 'Magnemite', eggGroups: ['mineral'], isGenderless: true });
const GENDERLESS_MONSTER = makeSpecies({ id: 201, name: 'GenderlessMon', eggGroups: ['monster'], isGenderless: true });
const DITTO = makeSpecies({ id: 132, name: 'Ditto', eggGroups: ['ditto'], isGenderless: true });

const ALL = [BULBASAUR, CHARMANDER, GASTLY, MEWTWO, MAGNEMITE, GENDERLESS_MONSTER, DITTO];
const getSpecies = (id: number) => ALL.find((s) => s.id === id);

describe('getCompatibleSpecies', () => {
  it('includes a gendered species sharing an egg group, with Ditto pinned first', () => {
    const result = getCompatibleSpecies(1, getSpecies, ALL);
    expect(result.map((s) => s.id)).toEqual([132, 4]);
  });

  it('excludes non-sharing, no-eggs, genderless-non-Ditto species, and the target itself', () => {
    const ids = getCompatibleSpecies(1, getSpecies, ALL).map((s) => s.id);
    expect(ids).not.toContain(92); // Gastly: no shared group
    expect(ids).not.toContain(150); // Mewtwo: no-eggs
    expect(ids).not.toContain(201); // genderless non-Ditto, even though it shares 'monster'
    expect(ids).not.toContain(1); // target itself
  });

  it('returns empty for a no-eggs target', () => {
    expect(getCompatibleSpecies(150, getSpecies, ALL)).toEqual([]);
  });

  it('returns Ditto-only for a genderless breedable target', () => {
    expect(getCompatibleSpecies(81, getSpecies, ALL).map((s) => s.id)).toEqual([132]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- compatiblePool`
Expected: FAIL — `compatiblePool.ts` / `getCompatibleSpecies` does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `src/engine/compatiblePool.ts`:

```typescript
import type { PokemonSpecies } from '../data/types';
import { DITTO_ID } from '../data/index';
import { sharesEggGroup } from './planner';

/**
 * Species that can contribute attributes into a breeding project for `targetSpeciesId`.
 * Offspring take the mother's species, so contributors are acquired as males (or Ditto);
 * genderless non-Ditto species and `no-eggs` species cannot feed the target line.
 */
export function getCompatibleSpecies(
  targetSpeciesId: number,
  getSpecies: (id: number) => PokemonSpecies | undefined,
  all: PokemonSpecies[],
): PokemonSpecies[] {
  const target = getSpecies(targetSpeciesId);
  if (!target) return [];
  if (target.eggGroups.includes('no-eggs')) return []; // cannot be bred at all
  const ditto = getSpecies(DITTO_ID);
  if (target.isGenderless) return ditto ? [ditto] : []; // breedable only with Ditto

  const pool = all
    .filter(
      (s) =>
        s.id !== targetSpeciesId &&
        s.id !== DITTO_ID &&
        !s.eggGroups.includes('no-eggs') &&
        !s.isGenderless &&
        sharesEggGroup(s, target),
    )
    .sort((a, b) => a.id - b.id);

  return ditto ? [ditto, ...pool] : pool;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit -- compatiblePool`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/compatiblePool.ts src/engine/compatiblePool.test.ts
git commit -m "feat: getCompatibleSpecies engine function"
```

---

## Task 3: `computeCoverage` engine function

**Files:**
- Modify: `src/engine/compatiblePool.ts`
- Test: `src/engine/compatiblePool.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `src/engine/compatiblePool.test.ts`:

```typescript
import { computeCoverage } from './compatiblePool';
import type { OwnedPokemon, BreedingGoal } from '../store/types';

function makeMon(overrides?: Partial<OwnedPokemon>): OwnedPokemon {
  return {
    id: 'mon',
    speciesId: 1,
    ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    nature: 'Hardy',
    ability: 'Overgrow',
    isHiddenAbility: false,
    gender: 'male',
    isShiny: false,
    isAlpha: false,
    eggMoves: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const GOAL: BreedingGoal = {
  speciesId: 1,
  targetIVs: { hp: 31, atk: 31 },
  nature: 'Adamant',
};

describe('computeCoverage', () => {
  it('builds one entry per target IV plus the nature, in order', () => {
    const result = computeCoverage(GOAL, [], getSpecies);
    expect(result.map((c) => c.attribute)).toEqual([
      { kind: 'iv', stat: 'hp' },
      { kind: 'iv', stat: 'atk' },
      { kind: 'nature', nature: 'Adamant' },
    ]);
    expect(result.every((c) => c.isGap)).toBe(true); // no owned mons → all gaps
  });

  it('counts a different-species MALE carrier, but not a different-species FEMALE', () => {
    const male = makeMon({ id: 'm', speciesId: 4, gender: 'male', ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
    const female = makeMon({ id: 'f', speciesId: 4, gender: 'female', ivs: { hp: 0, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 } });
    const result = computeCoverage(GOAL, [male, female], getSpecies);
    const hp = result.find((c) => c.attribute.kind === 'iv' && c.attribute.stat === 'hp')!;
    const atk = result.find((c) => c.attribute.kind === 'iv' && c.attribute.stat === 'atk')!;
    expect(hp.carriers.map((m) => m.id)).toEqual(['m']);
    expect(hp.isGap).toBe(false);
    expect(atk.carriers).toEqual([]); // female of a different species cannot feed the line
    expect(atk.isGap).toBe(true);
  });

  it('counts same-species (any gender), Ditto, and nature matches', () => {
    const sameSpeciesFemale = makeMon({ id: 's', speciesId: 1, gender: 'female', nature: 'Adamant' });
    const ditto = makeMon({ id: 'd', speciesId: 132, gender: 'genderless', ivs: { hp: 0, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 } });
    const result = computeCoverage(GOAL, [sameSpeciesFemale, ditto], getSpecies);
    const atk = result.find((c) => c.attribute.kind === 'iv' && c.attribute.stat === 'atk')!;
    const nature = result.find((c) => c.attribute.kind === 'nature')!;
    expect(atk.carriers.map((m) => m.id)).toEqual(['d']);
    expect(nature.carriers.map((m) => m.id)).toEqual(['s']);
  });

  it('omits the nature entry when the goal sets no nature', () => {
    const result = computeCoverage({ speciesId: 1, targetIVs: { hp: 31 } }, [], getSpecies);
    expect(result.map((c) => c.attribute)).toEqual([{ kind: 'iv', stat: 'hp' }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:unit -- compatiblePool`
Expected: FAIL — `computeCoverage` is not exported.

- [ ] **Step 3: Add the implementation**

Append to `src/engine/compatiblePool.ts`:

```typescript
import type { OwnedPokemon, BreedingGoal, StatKey } from '../store/types';
import type { Attribute } from './types';
import { isCompatible, carriesAttribute } from './planner';

const STAT_ORDER: StatKey[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

export interface AttributeCoverage {
  attribute: Attribute;
  carriers: OwnedPokemon[];
  isGap: boolean;
}

function goalAttributes(goal: BreedingGoal): Attribute[] {
  const attrs: Attribute[] = [];
  for (const stat of STAT_ORDER) {
    if (goal.targetIVs[stat] === 31) attrs.push({ kind: 'iv', stat });
  }
  if (goal.nature) attrs.push({ kind: 'nature', nature: goal.nature });
  return attrs;
}

/** A mon can feed the target line if it's the same species, a Ditto, or a different-species male. */
function canContribute(mon: OwnedPokemon, goal: BreedingGoal): boolean {
  if (mon.speciesId === goal.speciesId) return true;
  if (mon.speciesId === DITTO_ID) return true;
  return mon.gender === 'male';
}

export function computeCoverage(
  goal: BreedingGoal,
  owned: OwnedPokemon[],
  getSpecies: (id: number) => PokemonSpecies | undefined,
): AttributeCoverage[] {
  return goalAttributes(goal).map((attribute) => {
    const carriers = owned.filter(
      (mon) =>
        isCompatible(mon, goal, getSpecies) &&
        carriesAttribute(mon, attribute) &&
        canContribute(mon, goal),
    );
    return { attribute, carriers, isGap: carriers.length === 0 };
  });
}
```

Also extend the existing import block at the top of the file so `DITTO_ID`, the new type imports, and `isCompatible`/`carriesAttribute` are all imported once (merge with the imports added in Task 2 — do not duplicate the `DITTO_ID` import).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:unit -- compatiblePool`
Expected: PASS (8 tests total).

- [ ] **Step 5: Re-export from the engine barrel**

In `src/engine/index.ts`, add to the existing re-exports:

```typescript
export { getCompatibleSpecies, computeCoverage } from './compatiblePool';
export type { AttributeCoverage } from './compatiblePool';
```

- [ ] **Step 6: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add src/engine/compatiblePool.ts src/engine/compatiblePool.test.ts src/engine/index.ts
git commit -m "feat: computeCoverage engine function with gender constraint"
```

---

## Task 4: `BreedingPoolSection` component

**Files:**
- Create: `src/features/projects/BreedingPoolSection.tsx`

- [ ] **Step 1: Write the component**

Create `src/features/projects/BreedingPoolSection.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { Card, Title, Stack, Group, Text, Badge, Button, TextInput } from '@mantine/core';
import type { BreedingGoal, OwnedPokemon } from '../../store/types';
import type { Attribute } from '../../engine/types';
import { getSpeciesById, allSpecies } from '../../data/index';
import { computeCoverage, getCompatibleSpecies } from '../../engine/index';
import { PokemonAvatar } from '../../components/PokemonAvatar';
import { STAT_LABELS } from './projectHelpers';

interface BreedingPoolSectionProps {
  goal: BreedingGoal;
  ownedPokemon: OwnedPokemon[];
}

function attributeLabel(attr: Attribute): string {
  return attr.kind === 'iv' ? `${STAT_LABELS[attr.stat]} 31` : attr.nature;
}

export function BreedingPoolSection({ goal, ownedPokemon }: BreedingPoolSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');

  const coverage = useMemo(
    () => computeCoverage(goal, ownedPokemon, getSpeciesById),
    [goal, ownedPokemon],
  );
  const pool = useMemo(
    () => getCompatibleSpecies(goal.speciesId, getSpeciesById, allSpecies),
    [goal.speciesId],
  );
  const filteredPool = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? pool.filter((s) => s.name.toLowerCase().includes(q)) : pool;
  }, [pool, search]);

  return (
    <Card withBorder radius="md" padding="md">
      <Title order={4} mb="sm">
        Breeding Pool
      </Title>

      <Stack gap="xs">
        {coverage.length === 0 && (
          <Text size="sm" c="dimmed">
            This goal has no target IVs or nature set.
          </Text>
        )}
        {coverage.map((cov) => (
          <Group key={attributeLabel(cov.attribute)} gap="xs" wrap="wrap">
            <Text size="sm" fw={600} w={70}>
              {attributeLabel(cov.attribute)}
            </Text>
            {cov.isGap ? (
              <Badge color="orange" variant="light">
                Gap — acquire a male/Ditto carrier
              </Badge>
            ) : (
              cov.carriers.map((mon) => (
                <PokemonAvatar key={mon.id} speciesId={mon.speciesId} size={24} showName />
              ))
            )}
          </Group>
        ))}
      </Stack>

      <Button variant="subtle" size="xs" mt="sm" onClick={() => setExpanded((v) => !v)}>
        {expanded ? '▼' : '▶'} Compatible species ({pool.length})
      </Button>

      {expanded && (
        <Stack gap="xs" mt="xs">
          {pool.length === 0 ? (
            <Text size="sm" c="dimmed">
              This species cannot be bred (no compatible egg group).
            </Text>
          ) : (
            <>
              <Text size="xs" c="dimmed">
                Contributors should be male or Ditto — your female parent stays the target species.
              </Text>
              <TextInput
                placeholder="Search by species name…"
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                aria-label="Search compatible species"
                style={{ maxWidth: 320 }}
              />
              <Group gap="sm" wrap="wrap">
                {filteredPool.map((s) => (
                  <Group key={s.id} gap={4} wrap="nowrap">
                    <PokemonAvatar speciesId={s.id} size={28} showName />
                    {s.eggGroups.map((g) => (
                      <Badge key={g} size="xs" variant="outline" color="gray">
                        {g}
                      </Badge>
                    ))}
                  </Group>
                ))}
              </Group>
            </>
          )}
        </Stack>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS (no unused imports, no type errors).

- [ ] **Step 3: Commit**

```bash
git add src/features/projects/BreedingPoolSection.tsx
git commit -m "feat: BreedingPoolSection component"
```

---

## Task 5: Render the section on the project detail page

**Files:**
- Modify: `src/features/projects/ProjectDetailPage.tsx` (import near line 27; insert near line 747)

- [ ] **Step 1: Add the import**

Add to the imports at the top of `src/features/projects/ProjectDetailPage.tsx` (next to the other `./` feature imports):

```tsx
import { BreedingPoolSection } from './BreedingPoolSection';
```

- [ ] **Step 2: Insert the component between the Recommendation card and the Cost Estimate card**

Find this existing JSX (around lines 745-749):

```jsx
          </Card>
        )}

        {/* ── 4. Estimate & cost card ── */}
        <Card withBorder radius="md" padding="md">
```

Insert the section between the `)}` that closes the Recommendation card block and the Cost Estimate comment, so it reads:

```jsx
          </Card>
        )}

        <BreedingPoolSection goal={project.goal} ownedPokemon={ownedPokemon} />

        {/* ── 4. Estimate & cost card ── */}
        <Card withBorder radius="md" padding="md">
```

(`project` and `ownedPokemon` are already in scope from the store hooks at the top of the component.)

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/projects/ProjectDetailPage.tsx
git commit -m "feat: show Breeding Pool section on project detail page"
```

---

## Task 6: End-to-end test

**Files:**
- Modify: `e2e/projects.spec.ts` (add one `test(...)` inside the existing `test.describe('Projects feature', ...)`)

- [ ] **Step 1: Add the e2e test**

Add this test inside the existing `test.describe('Projects feature', () => { ... })` block in `e2e/projects.spec.ts` (it reuses the file's existing `freshStart` and `openGoalFormAndFill` helpers):

```typescript
test('Breeding Pool shows coverage gaps and compatible species', async ({ page }) => {
  await freshStart(page);

  await openGoalFormAndFill(page, {
    trigger: 'emptyState',
    name: 'Bulba Pool',
    species: 'Bulbasaur',
    stats: ['Target HP', 'Target Atk'],
  });
  await page.getByRole('dialog').getByRole('button', { name: 'Create Project' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();

  // Open the project detail page.
  await page.getByText('Bulba Pool').click();
  await expect(page.getByRole('heading', { name: 'Bulba Pool' })).toBeVisible();

  // Breeding Pool section is present; with no owned Pokémon every attribute is a gap.
  await expect(page.getByRole('heading', { name: 'Breeding Pool' })).toBeVisible();
  await expect(page.getByText(/Gap — acquire a male\/Ditto carrier/).first()).toBeVisible();

  // Expand the compatible-species list; Ditto is always a universal option.
  await page.getByRole('button', { name: /Compatible species/ }).click();
  await expect(page.getByText('Ditto').first()).toBeVisible();
});
```

- [ ] **Step 2: Run the e2e test**

Run: `npm run test:e2e -- projects`
Expected: PASS (the new test plus the existing project specs stay green).

- [ ] **Step 3: Commit**

```bash
git add e2e/projects.spec.ts
git commit -m "test: e2e for Breeding Pool section"
```

---

## Task 7: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Run the complete suite**

Run: `npm run test:unit && npm run typecheck && npm run lint && npm run test:e2e`
Expected: all PASS. If any failure is attributable to this change, fix it before considering the work done; report any pre-existing failures separately.

- [ ] **Step 2: Final commit (only if Step 1 required fixes)**

```bash
git add -A
git commit -m "fix: address verification findings for Breeding Pool"
```

---

## Self-Review (author checklist — completed)

- **Spec coverage:** discovery pool → Task 2; owned coverage + gaps + gender constraint + genderless/no-eggs exclusions → Task 3; collapsible UI with coverage rows, expandable searchable species list, contributor note, edge messages → Task 4/5; engine unit tests → Tasks 2-3; Playwright e2e → Task 6. All spec sections mapped.
- **Placeholder scan:** none — every code/test step contains complete code and exact commands.
- **Type consistency:** `getCompatibleSpecies`, `computeCoverage`, `AttributeCoverage`, `sharesEggGroup`, `canContribute`, `goalAttributes` used identically across tasks; `Attribute` reused from `src/engine/types.ts`; `STAT_LABELS` from `projectHelpers`. `DITTO_ID` imported once in `compatiblePool.ts` (Task 2), reused by Task 3 — noted to avoid a duplicate import.
- **Deviation noted:** the compatible-species list is rendered as a flat searchable list with per-row egg-group badges rather than literal per-group section headings — same information, simpler and equally testable (YAGNI).
