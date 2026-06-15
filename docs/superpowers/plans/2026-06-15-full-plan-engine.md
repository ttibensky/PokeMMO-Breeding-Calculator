# Full-Plan Breeding Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pure `buildFullPlan()` engine function that produces a complete forward breeding plan (full pyramid tree) with owned Pokémon slotted high and pruned, exposing the reservation set and acquisition gaps.

**Architecture:** Two pure phases in a new `src/engine/fullPlan.ts`. (1) `buildPyramidSpec()` builds the canonical top-down attribute pyramid: a node guaranteeing attribute set `S` splits into two children `S\{first}` and `S\{last}` that share the middle attributes (guaranteed free, both parents 31) while the dropped first/last attributes are pinned by one held item each. (2) An assignment walk slots compatible owned mons as high as they fit (pruning their subtree) and turns unmatched leaves into gaps. Correctness of the new backward decomposition is cross-checked against the existing forward predictor (`computeGuaranteedTargetStats`). No new persisted state; recomputed on demand.

**Tech Stack:** TypeScript, Vitest (`npm run test:unit`). Reuses existing engine helpers: `targetAttributes`, `carriesAttribute`, `isCompatible`, `goalMet` (`src/engine/planner.ts`), the `Attribute` discriminated union (`src/engine/types.ts`), `baseMonsNeeded` (`src/engine/pyramid.ts`).

**Spec:** `docs/superpowers/specs/2026-06-15-full-plan-engine-design.md`

**Note — deviation from spec signature:** The spec listed `buildFullPlan(pool, goal, settings, getSpecies)`. v1 does not use `settings` (per-node held-items/gender/cost are deferred — YAGNI), so the implemented signature is `buildFullPlan(pool, goal, getSpecies)` to stay lint-clean. Re-add `settings` when held-item resolution is built.

---

## File Structure

- **Create** `src/engine/fullPlan.ts` — the engine: `buildPyramidSpec()` (+ internal `SpecNode`), `buildFullPlan()`, and internal assignment helpers. One responsibility: turn pool + goal into a `FullPlan`.
- **Create** `src/engine/fullPlan.test.ts` — Vitest unit tests (co-located, mirrors `src/engine/planner.test.ts` factory style).
- **Modify** `src/engine/types.ts` — add public `PlanNode`, `PlanGap`, `FullPlan` interfaces (engine types live here, alongside `Attribute`, `OffspringPrediction`, `GoalEstimate`).
- **Modify** `src/engine/planner.ts` — change one word: `export` the existing internal `computeGuaranteedTargetStats` so the cross-check test can use it as the forward oracle.

Reference for test factories (copy the pattern, do not import — none is shared today): `src/engine/planner.test.ts:24-97`.

---

## Reference: existing symbols (verbatim, do not redefine)

```ts
// src/engine/types.ts:3-5
export type Attribute =
  | { kind: 'iv'; stat: StatKey }
  | { kind: 'nature'; nature: string };

// src/engine/planner.ts
export function targetAttributes(goal: BreedingGoal): Attribute[];          // IVs in stat order, nature last
export function carriesAttribute(mon: OwnedPokemon, attr: Attribute, goal?: BreedingGoal): boolean;
export function isCompatible(mon: OwnedPokemon, goal: BreedingGoal, getSpecies: (id: number) => PokemonSpecies | undefined): boolean;
export function goalMet(mon: OwnedPokemon, goal: BreedingGoal, getSpecies?: (id: number) => PokemonSpecies | undefined): boolean;
// internal today — Task 5 makes it `export`:
function computeGuaranteedTargetStats(a: OwnedPokemon, b: OwnedPokemon, items: { a?: ItemKey; b?: ItemKey }, goal: BreedingGoal, mechanics: Settings['mechanics']): StatKey[];

// src/engine/pyramid.ts:20-23
export function baseMonsNeeded(attributes: number): number;                 // 2^(attributes-1)

// StatKey values in use: 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe'
// ItemKey power items: powerWeight=hp, powerBracer=atk, powerBelt=def, powerLens=spa, powerBand=spd, powerAnklet=spe; everstone=nature
```

---

## Shared test fixture (used by every test step below)

Place this at the top of `src/engine/fullPlan.test.ts`. It mirrors `src/engine/planner.test.ts:24-97`.

```ts
import { describe, it, expect } from 'vitest';
import { buildPyramidSpec, buildFullPlan } from './fullPlan';
import { computeGuaranteedTargetStats } from './planner';
import { baseMonsNeeded } from './pyramid';
import type { OwnedPokemon, BreedingGoal, ItemKey } from '../store/types';
import type { PlanNode } from './types';
import { DEFAULT_SETTINGS } from '../store/defaults';
import type { PokemonSpecies } from '../data/types';

let _idCounter = 0;
function freshId(): string {
  return `mon-${++_idCounter}`;
}

function makeMon(overrides: Partial<OwnedPokemon> = {}): OwnedPokemon {
  return {
    id: freshId(),
    speciesId: 1,
    ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    nature: 'Hardy',
    ability: 'Overgrow',
    isHiddenAbility: false,
    gender: 'female',
    isShiny: false,
    isAlpha: false,
    eggMoves: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeGoal(overrides: Partial<BreedingGoal> = {}): BreedingGoal {
  return { speciesId: 1, targetIVs: {}, ...overrides };
}

function makeSpecies(id: number, partial: Partial<PokemonSpecies> = {}): PokemonSpecies {
  return {
    id,
    name: `Species${id}`,
    types: ['normal'],
    spriteUrl: '',
    eggGroups: ['monster'],
    genderRate: 4,
    isGenderless: false,
    femaleRatio: 0.5,
    abilities: [{ name: 'Overgrow', isHidden: false }],
    moves: [],
    ...partial,
  };
}

const SPECIES_MAP: Record<number, PokemonSpecies> = {
  1: makeSpecies(1),
  132: makeSpecies(132, { name: 'Ditto', eggGroups: ['ditto'], isGenderless: true, femaleRatio: 0 }),
};

function getSpecies(id: number): PokemonSpecies | undefined {
  return SPECIES_MAP[id];
}
```

---

### Task 1: Canonical pyramid spec builder

**Files:**
- Create: `src/engine/fullPlan.ts`
- Test: `src/engine/fullPlan.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/engine/fullPlan.test.ts` (below the fixture):

```ts
describe('buildPyramidSpec', () => {
  it('returns a childless leaf for a single attribute', () => {
    const spec = buildPyramidSpec([{ kind: 'iv', stat: 'hp' }]);
    expect(spec.attributes).toHaveLength(1);
    expect(spec.children).toBeUndefined();
    expect(spec.newlyPinned).toBeUndefined();
  });

  it('returns a childless leaf for zero attributes', () => {
    const spec = buildPyramidSpec([]);
    expect(spec.attributes).toHaveLength(0);
    expect(spec.children).toBeUndefined();
  });

  it('splits a 2-attribute node into two single-attribute leaves and pins both', () => {
    const hp = { kind: 'iv', stat: 'hp' } as const;
    const atk = { kind: 'iv', stat: 'atk' } as const;
    const spec = buildPyramidSpec([hp, atk]);
    expect(spec.newlyPinned).toEqual([hp, atk]);
    expect(spec.children).toBeDefined();
    const [a, b] = spec.children!;
    expect(a.attributes).toEqual([atk]); // drop first
    expect(b.attributes).toEqual([hp]);  // drop last
  });

  it('keeps children at size k-1 sharing the middle attributes (balanced)', () => {
    const attrs = [
      { kind: 'iv', stat: 'hp' },
      { kind: 'iv', stat: 'atk' },
      { kind: 'iv', stat: 'def' },
    ] as const;
    const spec = buildPyramidSpec([...attrs]);
    const [a, b] = spec.children!;
    expect(a.attributes).toEqual([attrs[1], attrs[2]]); // drop first
    expect(b.attributes).toEqual([attrs[0], attrs[1]]); // drop last
    expect(spec.newlyPinned).toEqual([attrs[0], attrs[2]]);
  });

  it('produces 2^(N-1) leaves for N attributes', () => {
    const stats = ['hp', 'atk', 'def', 'spa', 'spe'] as const;
    const attrs = stats.map((stat) => ({ kind: 'iv' as const, stat }));
    const countLeaves = (n: { children?: unknown[] } & { attributes: unknown[] }): number =>
      n.children ? (n.children as never[]).reduce<number>((s, c) => s + countLeaves(c), 0) : 1;
    for (let n = 1; n <= 5; n++) {
      expect(countLeaves(buildPyramidSpec(attrs.slice(0, n)) as never)).toBe(baseMonsNeeded(n));
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/fullPlan.test.ts`
Expected: FAIL — `buildPyramidSpec` is not exported / module not found.

- [ ] **Step 3: Write the implementation**

Create `src/engine/fullPlan.ts`:

```ts
import type { Attribute } from './types';

export interface SpecNode {
  attributes: Attribute[];
  newlyPinned?: [Attribute, Attribute];
  children?: [SpecNode, SpecNode];
}

/**
 * Canonical top-down breeding pyramid for an attribute set.
 * A node guaranteeing `attributes` (size k >= 2) splits into:
 *   childA = attributes without the FIRST  (carries `last`,  lacks `first`)
 *   childB = attributes without the LAST   (carries `first`, lacks `last`)
 * The shared middle attributes are guaranteed free (both parents 31); the
 * dropped first/last are each pinned by one held item on the parent that has it.
 */
export function buildPyramidSpec(attributes: Attribute[]): SpecNode {
  if (attributes.length <= 1) {
    return { attributes };
  }
  const first = attributes[0];
  const last = attributes[attributes.length - 1];
  const childA = buildPyramidSpec(attributes.slice(1));
  const childB = buildPyramidSpec(attributes.slice(0, -1));
  return { attributes, newlyPinned: [first, last], children: [childA, childB] };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/fullPlan.test.ts`
Expected: PASS (all 5 `buildPyramidSpec` tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/fullPlan.ts src/engine/fullPlan.test.ts
git commit -m "feat(engine): add canonical breeding pyramid spec builder

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Public plan types

**Files:**
- Modify: `src/engine/types.ts`

No test step — this task only adds type declarations (nothing to assert at runtime). It is a prerequisite for Task 3.

- [ ] **Step 1: Add the interfaces**

At the top of `src/engine/types.ts`, ensure `BreedingGoal` is imported (add the line if missing; `StatKey` is already imported there):

```ts
import type { BreedingGoal } from '../store/types';
```

Append to `src/engine/types.ts`:

```ts
/** A node in a full breeding plan tree. */
export interface PlanNode {
  id: string;                                  // stable, derived from tree path ('0', '0.0', '0.1', ...)
  attributes: Attribute[];                     // what this node guarantees
  assignedOwnedId?: string;                    // set iff a current owned mon fills this node (then no children)
  newlyPinned?: [Attribute, Attribute];        // the two attributes this breed pins (breed nodes only)
  children?: [PlanNode, PlanNode];             // present iff this is a breed step
}

/** A leaf needing acquisition (no owned mon carries it). */
export interface PlanGap {
  nodeId: string;
  attributes: Attribute[];
  speciesId: number;                           // a breeding-compatible species to look for
}

/** Complete forward breeding plan for one goal over the current pool. */
export interface FullPlan {
  goal: BreedingGoal;
  done: boolean;                               // an owned mon already meets the goal
  root: PlanNode;
  reservedOwnedIds: string[];                  // current owned mons this plan consumes
  gaps: PlanGap[];
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: PASS (no errors; `BreedingGoal` resolves, no duplicate imports).

- [ ] **Step 3: Commit**

```bash
git add src/engine/types.ts
git commit -m "feat(engine): add FullPlan / PlanNode / PlanGap types

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `buildFullPlan` — assignment, prune, gaps, reservation

**Files:**
- Modify: `src/engine/fullPlan.ts`
- Test: `src/engine/fullPlan.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/engine/fullPlan.test.ts`:

```ts
describe('buildFullPlan — assignment & gaps', () => {
  const fiveIvGoal = makeGoal({
    targetIVs: { hp: 31, atk: 31, def: 31, spa: 31, spe: 31 },
  });

  it('empty pool: every leaf is a gap, none reserved', () => {
    const plan = buildFullPlan([], fiveIvGoal, getSpecies);
    expect(plan.done).toBe(false);
    expect(plan.reservedOwnedIds).toEqual([]);
    expect(plan.gaps).toHaveLength(baseMonsNeeded(5)); // 16
    expect(plan.gaps.every((g) => g.speciesId === 1)).toBe(true);
    expect(plan.root.id).toBe('0');
  });

  it('assigns a single-attribute owned mon to a matching leaf', () => {
    const hpMon = makeMon({ ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
    const plan = buildFullPlan([hpMon], fiveIvGoal, getSpecies);
    expect(plan.reservedOwnedIds).toEqual([hpMon.id]);
    expect(plan.gaps).toHaveLength(baseMonsNeeded(5) - 1); // 15
  });

  it('slots a multi-attribute mon high and prunes its subtree', () => {
    const trio = makeMon({ ivs: { hp: 31, atk: 31, def: 31, spa: 0, spd: 0, spe: 0 } });
    const plan = buildFullPlan([trio], fiveIvGoal, getSpecies);
    expect(plan.reservedOwnedIds).toContain(trio.id);

    // The node it was assigned to carries exactly {hp,atk,def} and has no children (pruned).
    const findAssigned = (n: PlanNode): PlanNode | undefined => {
      if (n.assignedOwnedId === trio.id) return n;
      return n.children?.map(findAssigned).find(Boolean);
    };
    const node = findAssigned(plan.root)!;
    expect(node.children).toBeUndefined();
    expect(node.attributes.map((a) => (a.kind === 'iv' ? a.stat : a.nature)).sort())
      .toEqual(['atk', 'def', 'hp']);
    // Pruning removes the 3 leaves the trio replaces (a 3-attr subtree = 4 leaves -> 1 node).
    expect(plan.gaps.length).toBeLessThan(baseMonsNeeded(5));
  });

  it('minimal-surplus tie-break: the leaner mon takes the leaf, conserving the richer one', () => {
    // Goal {hp,atk,def}. monHpDef carries {hp,def}; monDef carries {def}. Both match the
    // [def] leaf. Surplus-blind id ordering would put monHpDef on [def] (smaller id), then
    // the [hp] leaf gaps because monDef has no hp. Minimal-surplus puts monDef on [def],
    // freeing monHpDef for [hp] — zero hp/def gaps.
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31, def: 31 } });
    const monHpDef = makeMon({ ivs: { hp: 31, atk: 0, def: 31, spa: 0, spd: 0, spe: 0 } });
    const monDef = makeMon({ ivs: { hp: 0, atk: 0, def: 31, spa: 0, spd: 0, spe: 0 } });
    const plan = buildFullPlan([monHpDef, monDef], goal, getSpecies); // monHpDef has the smaller id

    expect(plan.reservedOwnedIds).toContain(monDef.id);
    expect(plan.reservedOwnedIds).toContain(monHpDef.id);

    const defLeaf = (function find(n: PlanNode): PlanNode | undefined {
      if (!n.children && n.attributes.length === 1 && n.attributes[0].kind === 'iv'
          && n.attributes[0].stat === 'def' && n.assignedOwnedId) return n;
      return n.children?.map(find).find(Boolean);
    })(plan.root);
    expect(defLeaf?.assignedOwnedId).toBe(monDef.id);

    // No gap is for hp or def — both were covered by the two owned mons.
    const gapStats = plan.gaps.flatMap((g) => g.attributes.map((a) => (a.kind === 'iv' ? a.stat : a.nature)));
    expect(gapStats).not.toContain('hp');
    expect(gapStats).not.toContain('def');
  });

  it('ignores incompatible mons (wrong egg group, non-Ditto)', () => {
    const alien = makeMon({ speciesId: 1, ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
    // Goal species shares egg group with species 1, so make the mon a species not in the pool/egg group:
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 }, speciesId: 1 });
    const incompatible = makeMon({ speciesId: 999, ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
    const plan = buildFullPlan([incompatible], goal, getSpecies);
    expect(plan.reservedOwnedIds).not.toContain(incompatible.id);
    // sanity: a compatible same-species mon WOULD be used
    const ok = buildFullPlan([alien], goal, getSpecies);
    expect(ok.reservedOwnedIds).toContain(alien.id);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/fullPlan.test.ts -t 'assignment & gaps'`
Expected: FAIL — `buildFullPlan` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `src/engine/fullPlan.ts`. First extend the imports at the top of the file:

```ts
import type { Attribute, FullPlan, PlanNode, PlanGap } from './types';
import type { OwnedPokemon, BreedingGoal } from '../store/types';
import type { PokemonSpecies } from '../data/types';
import { targetAttributes, carriesAttribute, isCompatible, goalMet } from './planner';
```

Then add the implementation:

```ts
function carriesAll(mon: OwnedPokemon, attrs: Attribute[], goal: BreedingGoal): boolean {
  return attrs.every((a) => carriesAttribute(mon, a, goal));
}

function carriedCount(mon: OwnedPokemon, allAttrs: Attribute[], goal: BreedingGoal): number {
  return allAttrs.filter((a) => carriesAttribute(mon, a, goal)).length;
}

function assign(
  spec: SpecNode,
  pool: OwnedPokemon[],
  used: Set<string>,
  goal: BreedingGoal,
  allAttrs: Attribute[],
  path: string,
  gaps: PlanGap[],
): PlanNode {
  const candidates = pool
    .filter((m) => !used.has(m.id) && carriesAll(m, spec.attributes, goal))
    .sort((x, y) => {
      const cx = carriedCount(x, allAttrs, goal);
      const cy = carriedCount(y, allAttrs, goal);
      if (cx !== cy) return cx - cy;        // fewest surplus attributes first
      return x.id < y.id ? -1 : 1;          // deterministic tie-break
    });

  if (candidates.length > 0) {
    const chosen = candidates[0];
    used.add(chosen.id);
    return { id: path, attributes: spec.attributes, assignedOwnedId: chosen.id };
  }

  if (!spec.children) {
    gaps.push({ nodeId: path, attributes: spec.attributes, speciesId: goal.speciesId });
    return { id: path, attributes: spec.attributes };
  }

  const childA = assign(spec.children[0], pool, used, goal, allAttrs, `${path}.0`, gaps);
  const childB = assign(spec.children[1], pool, used, goal, allAttrs, `${path}.1`, gaps);
  return { id: path, attributes: spec.attributes, newlyPinned: spec.newlyPinned, children: [childA, childB] };
}

export function buildFullPlan(
  pool: OwnedPokemon[],
  goal: BreedingGoal,
  getSpecies: (id: number) => PokemonSpecies | undefined,
): FullPlan {
  const attrs = targetAttributes(goal);
  const spec = buildPyramidSpec(attrs);
  const available = pool.filter((m) => isCompatible(m, goal, getSpecies));
  const used = new Set<string>();
  const gaps: PlanGap[] = [];
  const root = assign(spec, available, used, goal, attrs, '0', gaps);
  return {
    goal,
    done: false,
    root,
    reservedOwnedIds: [...used].sort(),
    gaps,
  };
}
```

Note: `goalMet` is imported now but used in Task 4 (`done` short-circuit). If your linter blocks the unused import between tasks, add the `done` logic from Task 4 in the same pass. Otherwise complete Task 4 before running lint.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/fullPlan.test.ts`
Expected: PASS (Task 1 tests + all `assignment & gaps` tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/fullPlan.ts src/engine/fullPlan.test.ts
git commit -m "feat(engine): build full plan with slot-high assignment and gaps

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `done` short-circuit & trivial goals

**Files:**
- Modify: `src/engine/fullPlan.ts`
- Test: `src/engine/fullPlan.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/engine/fullPlan.test.ts`:

```ts
describe('buildFullPlan — done & trivial goals', () => {
  it('done=true when an owned mon already meets the goal', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 }, speciesId: 1 });
    const finished = makeMon({ speciesId: 1, ivs: { hp: 31, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 } });
    const plan = buildFullPlan([finished], goal, getSpecies);
    expect(plan.done).toBe(true);
    expect(plan.reservedOwnedIds).toEqual([finished.id]);
    expect(plan.root.assignedOwnedId).toBe(finished.id);
    expect(plan.root.children).toBeUndefined();
    expect(plan.gaps).toEqual([]);
  });

  it('single-attribute goal: one leaf, gap when pool is empty', () => {
    const goal = makeGoal({ targetIVs: { hp: 31 }, speciesId: 1 });
    const plan = buildFullPlan([], goal, getSpecies);
    expect(plan.done).toBe(false);
    expect(plan.root.children).toBeUndefined();
    expect(plan.gaps).toHaveLength(1);
  });

  it('zero-attribute goal: single leaf', () => {
    const goal = makeGoal({ targetIVs: {}, speciesId: 1 });
    const plan = buildFullPlan([], goal, getSpecies);
    expect(plan.root.children).toBeUndefined();
    expect(plan.gaps).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/fullPlan.test.ts -t 'done & trivial'`
Expected: FAIL — the `done=true` test fails (current code always returns `done: false`).

- [ ] **Step 3: Write the implementation**

In `src/engine/fullPlan.ts`, add the `done` short-circuit at the start of `buildFullPlan`, before building the spec:

```ts
export function buildFullPlan(
  pool: OwnedPokemon[],
  goal: BreedingGoal,
  getSpecies: (id: number) => PokemonSpecies | undefined,
): FullPlan {
  const attrs = targetAttributes(goal);

  const met = pool
    .filter((m) => goalMet(m, goal, getSpecies))
    .sort((x, y) => (x.id < y.id ? -1 : 1));
  if (met.length > 0) {
    const chosen = met[0];
    return {
      goal,
      done: true,
      root: { id: '0', attributes: attrs, assignedOwnedId: chosen.id },
      reservedOwnedIds: [chosen.id],
      gaps: [],
    };
  }

  const spec = buildPyramidSpec(attrs);
  const available = pool.filter((m) => isCompatible(m, goal, getSpecies));
  const used = new Set<string>();
  const gaps: PlanGap[] = [];
  const root = assign(spec, available, used, goal, attrs, '0', gaps);
  return { goal, done: false, root, reservedOwnedIds: [...used].sort(), gaps };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/fullPlan.test.ts`
Expected: PASS (all tests so far).

- [ ] **Step 5: Commit**

```bash
git add src/engine/fullPlan.ts src/engine/fullPlan.test.ts
git commit -m "feat(engine): short-circuit full plan when goal already met

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Forward-predictor cross-check

This validates the new backward decomposition against the trusted forward model: every breed node's two children, materialized with their pin items, must guarantee the node's IV attributes.

**Files:**
- Modify: `src/engine/planner.ts` (export one function)
- Test: `src/engine/fullPlan.test.ts`

- [ ] **Step 1: Export the forward oracle**

In `src/engine/planner.ts`, change the declaration of `computeGuaranteedTargetStats` (around line 293) from:

```ts
function computeGuaranteedTargetStats(
```

to:

```ts
export function computeGuaranteedTargetStats(
```

- [ ] **Step 2: Write the failing test**

Add to `src/engine/fullPlan.test.ts`:

```ts
describe('buildFullPlan — forward-predictor cross-check', () => {
  // StatKey -> Power item that pins it.
  const POWER_ITEM: Record<string, ItemKey> = {
    hp: 'powerWeight', atk: 'powerBracer', def: 'powerBelt',
    spa: 'powerLens', spd: 'powerBand', spe: 'powerAnklet',
  };

  // Build a concrete parent that carries exactly the given IV attributes at 31.
  function monFromAttrs(node: PlanNode, gender: 'male' | 'female'): OwnedPokemon {
    const ivs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    for (const a of node.attributes) {
      if (a.kind === 'iv') ivs[a.stat] = 31;
    }
    return makeMon({ speciesId: 1, gender, ivs });
  }

  it('every breed node guarantees its IV attributes via the forward predictor', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31, def: 31, spa: 31, spe: 31 } });
    const plan = buildFullPlan([], goal, getSpecies); // empty pool => full pyramid

    const visit = (n: PlanNode): void => {
      if (!n.children) return;
      const [childA, childB] = n.children; // childA dropped first, childB dropped last
      const [first, last] = n.newlyPinned!;  // first pinned on childB, last pinned on childA
      const parentA = monFromAttrs(childA, 'female'); // dropped first -> `last` is pinned here
      const parentB = monFromAttrs(childB, 'male');   // dropped last  -> `first` is pinned here
      const items: { a?: ItemKey; b?: ItemKey } = {};
      if (last.kind === 'iv') items.a = POWER_ITEM[last.stat];
      if (first.kind === 'iv') items.b = POWER_ITEM[first.stat];

      const guaranteed = computeGuaranteedTargetStats(
        parentA, parentB, items, goal, DEFAULT_SETTINGS.mechanics,
      );
      for (const a of n.attributes) {
        if (a.kind === 'iv') expect(guaranteed).toContain(a.stat);
      }
      n.children.forEach(visit);
    };

    visit(plan.root);
  });
});
```

Note: this cross-check uses an IV-only goal (the core mechanic). `last` is pinned on `parentA` (`items.a`), `first` is pinned on `parentB` (`items.b`).

- [ ] **Step 3: Run the test to verify it fails first, then passes**

Run: `npx vitest run src/engine/fullPlan.test.ts -t 'cross-check'`
Expected first run (before Step 1 export is saved): FAIL — `computeGuaranteedTargetStats` is not exported.
After Step 1 export: the assertion itself should PASS (the decomposition is correct). If it FAILS on the assertion, the bug is in `buildPyramidSpec`'s split/pin mapping — fix there, do not weaken the test.

- [ ] **Step 4: Commit**

```bash
git add src/engine/planner.ts src/engine/fullPlan.test.ts
git commit -m "test(engine): cross-check full-plan decomposition vs forward predictor

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Determinism

**Files:**
- Test: `src/engine/fullPlan.test.ts`

- [ ] **Step 1: Write the test**

Add to `src/engine/fullPlan.test.ts`:

```ts
describe('buildFullPlan — determinism', () => {
  it('produces identical trees, reservations, and gaps across repeated calls', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31, def: 31 } });
    const pool = [
      makeMon({ ivs: { hp: 31, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 } }),
      makeMon({ ivs: { hp: 0, atk: 0, def: 31, spa: 0, spd: 0, spe: 0 } }),
    ];
    const a = buildFullPlan(pool, goal, getSpecies);
    const b = buildFullPlan(pool, goal, getSpecies);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('uses stable path-based node ids', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 } });
    const plan = buildFullPlan([], goal, getSpecies);
    expect(plan.root.id).toBe('0');
    expect(plan.root.children?.map((c) => c.id)).toEqual(['0.0', '0.1']);
  });
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `npx vitest run src/engine/fullPlan.test.ts`
Expected: PASS (entire file green).

- [ ] **Step 3: Commit**

```bash
git add src/engine/fullPlan.test.ts
git commit -m "test(engine): assert full-plan determinism and stable node ids

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Full verification gate

**Files:** none (verification only).

- [ ] **Step 1: Unit tests**

Run: `npm run test:unit`
Expected: PASS — entire unit suite green, including `src/engine/fullPlan.test.ts`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: PASS — no type errors.

- [ ] **Step 3: Lint**

Run: `npx eslint .`
Expected: PASS — no errors. (Watch for unused-import/var warnings in `fullPlan.ts`; every import — `goalMet`, `isCompatible`, `carriesAttribute`, `targetAttributes` — is used by the final code.)

- [ ] **Step 4: Confirm no e2e needed**

The engine is a pure, non-visual function. No Playwright e2e in this plan — the consuming views (Breeding Tree Visualization, Pool Reservation View) get e2e coverage when they are built.

---

## Self-Review

**Spec coverage:**
- `buildFullPlan` pure function producing tree + assignments + `reservedOwnedIds` + gaps → Tasks 2–4. ✓
- Top-down canonical decomposition (drop-first / drop-last, pins) → Task 1. ✓
- Slot-high + prune with minimal-surplus greedy tie-break → Task 3. ✓
- Gaps with compatible `speciesId` → Task 3 (`goal.speciesId`). ✓
- `done` short-circuit + N=0/1 edge cases → Task 4. ✓
- Forward-predictor cross-check → Task 5. ✓
- Deterministic ids/order across recomputes → Task 6. ✓
- Pure/derived, no persisted state → no store changes anywhere. ✓
- Deferred (held-items/gender/cost, optimal assignment, next-step unification) → not implemented, as specified. ✓
- Unit tests, no e2e → Tasks 1–7. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every command has expected output. ✓

**Type consistency:** `SpecNode` (internal, Task 1) vs `PlanNode`/`PlanGap`/`FullPlan` (public, Task 2) used consistently in Tasks 3–6. `buildFullPlan(pool, goal, getSpecies)` signature identical across Tasks 3–6. `Attribute` discriminated union used verbatim from `src/engine/types.ts`. `computeGuaranteedTargetStats` signature matches the export in Task 5. ✓
