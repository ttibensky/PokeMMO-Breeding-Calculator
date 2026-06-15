# Whole-Project Cost Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `buildOptimalPlan` — a pool-aware planner that finds the provably minimum-total-Pokéyen breeding plan for a single project goal — gated behind a new `costOptimizer` feature toggle, and surface its cost, gaps, and a next-breed card in the existing project UI.

**Architecture:** A new pure engine module `src/engine/optimalPlan.ts` does an exact memoized subset-recursion over the goal's attributes (≤7 attributes ⇒ ≤128 subsets). The recursion mirrors real breeding pyramids — each breed pins 2 attributes and produces two overlapping `|S|−1` parents — and slots owned Pokémon at any node whose attribute set they cover (cost 0, used once), filling the rest with acquired base carriers. A defensive node cap falls back to the greedy `buildFullPlan` and flags the plan non-optimal. A thin adapter in the projects feature turns the resulting `FullPlan` into the existing `Plan` shape (estimate + gaps + next-breed `Recommendation`) by reusing the already-exported `validateManualPair`.

**Tech Stack:** TypeScript (pure functions, no new deps), Vitest (co-located unit tests), Playwright (e2e, hash routing), Mantine (`Switch` + `NumberInput`).

---

## Background facts (verified against source)

These are exact and the plan depends on them. Re-confirm if a file has drifted.

- **`Attribute`** (`src/engine/types.ts:4-6`):
  ```ts
  export type Attribute = { kind: 'iv'; stat: StatKey } | { kind: 'nature'; nature: string };
  ```
- **`PlanNode` / `PlanGap` / `FullPlan`** (`src/engine/types.ts`):
  ```ts
  export interface PlanNode { id: string; attributes: Attribute[]; assignedOwnedId?: string; newlyPinned?: [Attribute, Attribute]; children?: [PlanNode, PlanNode]; }
  export interface PlanGap  { nodeId: string; attributes: Attribute[]; speciesId: number; }
  export interface FullPlan { goal: BreedingGoal; done: boolean; root: PlanNode; reservedOwnedIds: string[]; gaps: PlanGap[]; }
  ```
- **`CostBreakdown` / `GoalEstimate`** (`src/engine/types.ts`):
  ```ts
  export interface CostBreakdown { powerItems: number; everstone: number; genderFees: number; abilityPill: number; ditto: number; total: number; }
  export interface GoalEstimate { attributeCount: number; baseMonsNeeded: number; totalBreeds: number; cost: CostBreakdown; assumptions: string[]; }
  ```
- **`Plan` / `Recommendation` / planner `Gap`** (`src/engine/planner.ts:62-97`):
  ```ts
  export interface Gap { attribute: Attribute; description: string; }
  export interface Recommendation { pair: PairCandidate; alternativesForA: string[]; alternativesForB: string[]; warnings: string[]; }
  export interface Plan { goal: BreedingGoal; done: boolean; matchingPokemonId?: string; recommendation: Recommendation | null; estimate: GoalEstimate; gaps: Gap[]; }
  ```
- **Exported planner helpers** (`src/engine/planner.ts`): `targetAttributes(goal): Attribute[]`, `carriesAttribute(mon, attr, goal?): boolean`, `isCompatible(mon, goal, getSpecies): boolean`, `goalMet(mon, goal, getSpecies?): boolean`, `STAT_TO_POWER_ITEM: Record<StatKey, Exclude<ItemKey,'everstone'>>`, and `validateManualPair(parentAId, parentBId, pool, goal, settings, getSpecies): { validation: ValidationResult; candidate?: PairCandidate }`.
- **`pyramid.ts`**: `attributeCount(goal): number`, `baseMonsNeeded(attributes: number): number` (= `2^(attributes-1)`), `totalBreeds(attributes: number): number` (= `2^(attributes-1)-1`).
- **`buildFullPlan(pool, goal, getSpecies): FullPlan`** (`src/engine/fullPlan.ts:56`) is the greedy slot-high baseline. It is **exported from `fullPlan.ts` but NOT from `src/engine/index.ts`** — this plan adds that re-export.
- **`estimateGoal`** and **`computeStepCost`** live in `src/engine/cost.ts`.
- **Settings** (`src/store/types.ts`): `Settings { prices: Record<PriceKey,number>; features: FeatureToggles; mechanics: MechanicConstants }`. `PriceKey = ItemKey | 'genderFeeBase' | 'genderFeeMax' | 'abilityPill' | 'ditto'`. `FeatureToggles { eggMoves; hiddenAbility; shiny; alpha }` (booleans). `mechanics.everstoneConsumed: boolean` (default **true**).
- **`DEFAULT_SETTINGS`** (`src/store/defaults.ts:3-31`): all power items `10000`, `everstone 15000`, `genderFeeBase 5000`, `genderFeeMax 25000`, `abilityPill 35000`, `ditto 30000`; all features `false`; `everstoneConsumed: true`.
- **`ProjectDetailPage`** (`src/features/projects/ProjectDetailPage.tsx`): imports `buildPlan` at line 27; calls it in a `useMemo` at lines 484-487; consumes `plan.done`, `plan.matchingPokemonId`, `plan.recommendation` (deeply: `rec.pair.parentAId/parentBId/items/forcedGender/estimatedStepCost/prediction.offspringSpeciesId`, `rec.warnings`), `plan.estimate.{totalBreeds,baseMonsNeeded,cost.*,assumptions}`, and `plan.gaps[].description`.
- **`SettingsPage`** (`src/features/settings/SettingsPage.tsx`): `FEE_KEYS`/`FEE_LABELS` arrays (lines 21-38) drive fee NumberInputs; feature toggles render as `<Switch label=... checked={settings.features.X} onChange={(e)=>updateFeatures({X:e.currentTarget.checked})} />`.
- **e2e helpers** (`e2e/settings.spec.ts`) already exist: `setNumberInput(page,label,value)`, `clickSwitch(page,label)`, `switchInput(page,label)`, `createBulbasaurProject(page,name)`.

## Cost model (the optimizer's objective)

Total Pokéyen the optimizer minimizes, identical to what `computePlanCost` (Task 3) sums over the produced tree:

- **Per breed node** (`newlyPinned = [x, y]`): for each pinned attribute, if it is an IV add `prices[STAT_TO_POWER_ITEM[stat]]`; if it is the nature add `prices.everstone` **only when** `mechanics.everstoneConsumed` is true.
- **Per gap leaf** (a single-attribute leaf with no owned carrier): add `prices.baseCarrier`.
- **Ability:** add `prices.abilityPill` once if `goal.ability` is set (non-empty).
- **Gender fees and Ditto:** modeled as `0` in v1 (documented out-of-scope simplification — the deterministic tree cost; goal-level gender requirements are surfaced through the next-breed card's own `computeStepCost`, not the plan estimate).

Owned Pokémon used as carriers cost 0. An owned Pokémon may be slotted at **any** node whose attribute set it fully covers, and each individual is used **at most once**.

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `src/store/types.ts` | modify | Add `baseCarrier` to `PriceKey`; add `costOptimizer` to `FeatureToggles` |
| `src/store/defaults.ts` | modify | `prices.baseCarrier: 10000`, `features.costOptimizer: false` |
| `src/store/defaults.test.ts` | create | Assert the two new defaults |
| `src/engine/types.ts` | modify | Add `optimal: boolean` to `FullPlan` |
| `src/engine/fullPlan.ts` | modify | Set `optimal: true` on both returns |
| `src/engine/index.ts` | modify | Re-export `buildFullPlan`, `buildOptimalPlan`, `computePlanCost`, `OPTIMIZER_NODE_CAP` |
| `src/engine/optimalPlan.ts` | create | `computePlanCost`, `buildOptimalPlan`, `OPTIMIZER_NODE_CAP` |
| `src/engine/optimalPlan.test.ts` | create | Unit + regression-oracle tests |
| `src/features/projects/projectPlannerSelector.ts` | create | `selectPlanner(settings)` + the optimizer→`Plan` adapter |
| `src/features/projects/projectPlannerSelector.test.ts` | create | Adapter + selection unit tests |
| `src/features/projects/ProjectDetailPage.tsx` | modify | Use `selectPlanner(settings)` in the `useMemo` |
| `src/features/settings/SettingsPage.tsx` | modify | `costOptimizer` Switch + `baseCarrier` NumberInput |
| `e2e/settings.spec.ts` | modify | Toggle persists + project page renders with optimizer on |

---

## Task 1 — Settings: `baseCarrier` price + `costOptimizer` toggle

**Files:**
- Modify: `src/store/types.ts`
- Modify: `src/store/defaults.ts`
- Test: `src/store/defaults.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/store/defaults.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from './defaults';

describe('DEFAULT_SETTINGS', () => {
  it('includes baseCarrier price defaulting to 10000', () => {
    expect(DEFAULT_SETTINGS.prices.baseCarrier).toBe(10000);
  });

  it('includes costOptimizer feature toggle defaulting to false', () => {
    expect(DEFAULT_SETTINGS.features.costOptimizer).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to confirm failure**

Run: `npm run test:unit -- src/store/defaults.test.ts`
Expected: FAIL — TypeScript errors that `baseCarrier` is not on `PriceKey` and `costOptimizer` is not on `FeatureToggles`.

- [ ] **Step 3: Add `baseCarrier` to `PriceKey` and `costOptimizer` to `FeatureToggles`**

In `src/store/types.ts`, change the `PriceKey` definition to append `| 'baseCarrier'`:

```ts
export type PriceKey =
  | ItemKey
  | 'genderFeeBase'
  | 'genderFeeMax'
  | 'abilityPill'
  | 'ditto'
  | 'baseCarrier';
```

And add `costOptimizer` to `FeatureToggles`:

```ts
export interface FeatureToggles {
  eggMoves: boolean;
  hiddenAbility: boolean;
  shiny: boolean;
  alpha: boolean;
  costOptimizer: boolean;
}
```

- [ ] **Step 4: Add the defaults**

In `src/store/defaults.ts`, add `baseCarrier: 10000` to the `prices` object (after `ditto`) and `costOptimizer: false` to the `features` object (after `alpha`):

```ts
  prices: {
    powerWeight: 10000,
    powerBracer: 10000,
    powerBelt: 10000,
    powerLens: 10000,
    powerBand: 10000,
    powerAnklet: 10000,
    everstone: 15000,
    genderFeeBase: 5000,
    genderFeeMax: 25000,
    abilityPill: 35000,
    ditto: 30000,
    baseCarrier: 10000,
  },
  features: {
    eggMoves: false,
    hiddenAbility: false,
    shiny: false,
    alpha: false,
    costOptimizer: false,
  },
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npm run test:unit -- src/store/defaults.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/store/types.ts src/store/defaults.ts src/store/defaults.test.ts
git commit -m "feat(store): add baseCarrier price and costOptimizer feature toggle"
```

---

## Task 2 — Add `optimal` flag to `FullPlan`; export `buildFullPlan`

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/engine/fullPlan.ts`
- Modify: `src/engine/index.ts`
- Test: `src/engine/fullPlan.test.ts` (add one assertion)

- [ ] **Step 1: Write the failing test**

In `src/engine/fullPlan.test.ts`, add this test inside the existing top-level `describe('buildFullPlan', ...)` block (reuse the file's existing `makeGoal`/`getSpecies` helpers — match their names if they differ):

```ts
it('sets optimal=true on the returned plan', () => {
  const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 } });
  const plan = buildFullPlan([], goal, getSpecies);
  expect(plan.optimal).toBe(true);
});
```

- [ ] **Step 2: Run it to confirm failure**

Run: `npm run test:unit -- src/engine/fullPlan.test.ts`
Expected: FAIL — `optimal` does not exist on `FullPlan`.

- [ ] **Step 3: Add `optimal` to `FullPlan`**

In `src/engine/types.ts`, add the field to `FullPlan` (after `gaps`):

```ts
export interface FullPlan {
  goal: BreedingGoal;
  done: boolean;
  root: PlanNode;
  reservedOwnedIds: string[];
  gaps: PlanGap[];
  optimal: boolean;
}
```

- [ ] **Step 4: Set `optimal: true` on both returns in `buildFullPlan`**

In `src/engine/fullPlan.ts`, the early `done` return (around lines 66-73) becomes:

```ts
return {
  goal,
  done: true,
  root: { id: '0', attributes: attrs, assignedOwnedId: chosen.id },
  reservedOwnedIds: [chosen.id],
  gaps: [],
  optimal: true,
};
```

And the final return (around line 130) becomes:

```ts
return { goal, done: false, root, reservedOwnedIds: [...used].sort(), gaps, optimal: true };
```

- [ ] **Step 5: Re-export `buildFullPlan` from the engine barrel**

In `src/engine/index.ts`, add (next to the other engine exports):

```ts
export { buildFullPlan } from './fullPlan';
```

- [ ] **Step 6: Run the test to confirm it passes**

Run: `npm run test:unit -- src/engine/fullPlan.test.ts`
Expected: PASS (existing tests + the new one).

- [ ] **Step 7: Commit**

```bash
git add src/engine/types.ts src/engine/fullPlan.ts src/engine/index.ts src/engine/fullPlan.test.ts
git commit -m "feat(engine): add optimal flag to FullPlan and export buildFullPlan"
```

---

## Task 3 — `computePlanCost` pure helper

This walks any `FullPlan` tree and returns a `CostBreakdown`. The optimizer minimizes exactly this; the adapter (Task 6) uses it for display; the regression oracle (Task 5) compares optimizer vs greedy with it.

**Files:**
- Create: `src/engine/optimalPlan.ts`
- Create: `src/engine/optimalPlan.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/engine/optimalPlan.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computePlanCost } from './optimalPlan';
import type { FullPlan, PlanNode } from './types';
import type { Settings, BreedingGoal } from '../store/types';
import { DEFAULT_SETTINGS } from '../store/defaults';

const S: Settings = DEFAULT_SETTINGS; // power items 10000, everstone 15000, baseCarrier 10000

function goal(targetIVs: BreedingGoal['targetIVs'], extra: Partial<BreedingGoal> = {}): BreedingGoal {
  return { speciesId: 1, targetIVs, ...extra };
}

const HP = { kind: 'iv', stat: 'hp' } as const;
const ATK = { kind: 'iv', stat: 'atk' } as const;

// A single breed of {hp,atk} from two acquired single-IV carriers.
function twoIvPlan(): FullPlan {
  const root: PlanNode = {
    id: '0',
    attributes: [HP, ATK],
    newlyPinned: [HP, ATK],
    children: [
      { id: '0.0', attributes: [HP] },
      { id: '0.1', attributes: [ATK] },
    ],
  };
  return {
    goal: goal({ hp: 31, atk: 31 }),
    done: false,
    root,
    reservedOwnedIds: [],
    gaps: [
      { nodeId: '0.0', attributes: [HP], speciesId: 1 },
      { nodeId: '0.1', attributes: [ATK], speciesId: 1 },
    ],
    optimal: true,
  };
}

describe('computePlanCost', () => {
  it('sums power items (one per pinned IV) and base-carrier acquisitions', () => {
    // 1 breed pinning hp+atk = 2 power items = 20000; 2 gap leaves = 2*10000 = 20000.
    const cost = computePlanCost(twoIvPlan(), S);
    expect(cost.powerItems).toBe(20000);
    expect(cost.everstone).toBe(0);
    expect(cost.abilityPill).toBe(0);
    expect(cost.total).toBe(40000);
  });

  it('charges everstone per nature-pinning breed when everstoneConsumed is true', () => {
    const NAT = { kind: 'nature', nature: 'Adamant' } as const;
    const root: PlanNode = {
      id: '0',
      attributes: [HP, NAT],
      newlyPinned: [HP, NAT],
      children: [
        { id: '0.0', attributes: [HP] },
        { id: '0.1', attributes: [NAT] },
      ],
    };
    const plan: FullPlan = {
      goal: goal({ hp: 31 }, { nature: 'Adamant' }),
      done: false, root, reservedOwnedIds: [],
      gaps: [
        { nodeId: '0.0', attributes: [HP], speciesId: 1 },
        { nodeId: '0.1', attributes: [NAT], speciesId: 1 },
      ],
      optimal: true,
    };
    // power item (hp) 10000 + everstone 15000 + 2 base carriers 20000 = 45000
    const cost = computePlanCost(plan, S);
    expect(cost.powerItems).toBe(10000);
    expect(cost.everstone).toBe(15000);
    expect(cost.total).toBe(45000);
  });

  it('adds the ability pill once when the goal requires an ability', () => {
    const plan = { ...twoIvPlan(), goal: goal({ hp: 31, atk: 31 }, { ability: 'Overgrow' }) };
    const cost = computePlanCost(plan, S);
    expect(cost.abilityPill).toBe(35000);
    expect(cost.total).toBe(40000 + 35000);
  });

  it('counts owned-carrier leaves as free (no acquisition cost)', () => {
    const plan = twoIvPlan();
    // Mark the first leaf as owned -> one fewer acquisition.
    plan.root.children![0] = { id: '0.0', attributes: [HP], assignedOwnedId: 'm1' };
    plan.gaps = [{ nodeId: '0.1', attributes: [ATK], speciesId: 1 }];
    const cost = computePlanCost(plan, S);
    // 2 power items (20000) + 1 base carrier (10000) = 30000
    expect(cost.total).toBe(30000);
  });
});
```

- [ ] **Step 2: Run it to confirm failure**

Run: `npm run test:unit -- src/engine/optimalPlan.test.ts`
Expected: FAIL — `computePlanCost` is not exported from `./optimalPlan`.

- [ ] **Step 3: Implement `computePlanCost`**

Create `src/engine/optimalPlan.ts`:

```ts
import type { Attribute, CostBreakdown, FullPlan, PlanNode } from './types';
import type { Settings } from '../store/types';
import { STAT_TO_POWER_ITEM } from './planner';

/** Price of pinning a single attribute at one breed step. */
function pinPrice(attr: Attribute, settings: Settings): { powerItems: number; everstone: number } {
  if (attr.kind === 'iv') {
    return { powerItems: settings.prices[STAT_TO_POWER_ITEM[attr.stat]], everstone: 0 };
  }
  // nature: only costs an everstone when everstones are consumed per breed
  return { powerItems: 0, everstone: settings.mechanics.everstoneConsumed ? settings.prices.everstone : 0 };
}

/**
 * Walk a FullPlan tree and total its cost: power items + everstones across breed nodes,
 * base-carrier acquisitions for gap leaves, and one ability pill if the goal needs an ability.
 * Gender fees and Ditto are modeled as 0 (deterministic tree cost — see plan cost model).
 */
export function computePlanCost(plan: FullPlan, settings: Settings): CostBreakdown {
  let powerItems = 0;
  let everstone = 0;

  const walk = (node: PlanNode): void => {
    if (node.children) {
      for (const attr of node.newlyPinned ?? []) {
        const p = pinPrice(attr, settings);
        powerItems += p.powerItems;
        everstone += p.everstone;
      }
      walk(node.children[0]);
      walk(node.children[1]);
    }
  };
  walk(plan.root);

  const acquisitions = plan.gaps.length * settings.prices.baseCarrier;
  const abilityPill = plan.goal.ability ? settings.prices.abilityPill : 0;
  const total = powerItems + everstone + acquisitions + abilityPill;

  return { powerItems, everstone, genderFees: 0, abilityPill, ditto: 0, total };
}
```

> Note: `total` includes `acquisitions`, which has no dedicated `CostBreakdown` line (the type predates this feature). The adapter in Task 6 surfaces the acquisition subtotal in `estimate.assumptions` so the displayed total is explained.

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm run test:unit -- src/engine/optimalPlan.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/optimalPlan.ts src/engine/optimalPlan.test.ts
git commit -m "feat(engine): add computePlanCost tree-cost accumulator"
```

---

## Task 4 — `buildOptimalPlan` core search

Exact memoized subset-recursion. At a node for attribute set `S`:
- if an available owned mon covers `S`, terminate the subtree (cost 0, consume the mon);
- else if `|S| == 1`, acquire a base carrier (a gap leaf);
- else pick 2 distinct attributes `x, y ∈ S` to pin: children are `S\{x}` and `S\{y}` (each size `|S|−1`, overlapping in `|S|−2`), and the relevant owned mons are partitioned across the two child subtrees so no individual is used twice.

**Files:**
- Modify: `src/engine/optimalPlan.ts`
- Modify: `src/engine/optimalPlan.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/optimalPlan.test.ts`:

```ts
import { buildOptimalPlan } from './optimalPlan';
import type { OwnedPokemon } from '../store/types';
import type { PokemonSpecies } from '../data/types';

function getSpecies(id: number): PokemonSpecies | undefined {
  if (id !== 1) return undefined;
  return {
    id: 1, name: 'S1', types: ['normal'], spriteUrl: '',
    eggGroups: ['monster'], genderRate: 4, isGenderless: false,
    femaleRatio: 0.5, abilities: ['Overgrow'], moves: [],
  } as PokemonSpecies;
}

let seq = 0;
function mon(ivs: Partial<OwnedPokemon['ivs']>, id?: string): OwnedPokemon {
  return {
    id: id ?? `m${seq++}`,
    speciesId: 1,
    ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...ivs },
    nature: 'Hardy', ability: 'Overgrow', isHiddenAbility: false,
    gender: 'female', isShiny: false, isAlpha: false,
    eggMoves: [], createdAt: '2024-01-01T00:00:00.000Z',
  };
}

describe('buildOptimalPlan', () => {
  it('done=true when an owned mon already meets the goal', () => {
    const g = goal({ hp: 31, atk: 31 });
    const m = mon({ hp: 31, atk: 31 }, 'done1');
    const plan = buildOptimalPlan([m], g, S, getSpecies);
    expect(plan.done).toBe(true);
    expect(plan.optimal).toBe(true);
    expect(plan.gaps).toEqual([]);
    expect(plan.reservedOwnedIds).toEqual(['done1']);
  });

  it('empty pool, 2 IVs: 2 gap leaves, cost 40000', () => {
    const g = goal({ hp: 31, atk: 31 });
    const plan = buildOptimalPlan([], g, S, getSpecies);
    expect(plan.done).toBe(false);
    expect(plan.gaps).toHaveLength(2);
    expect(plan.optimal).toBe(true);
    expect(computePlanCost(plan, S).total).toBe(40000);
  });

  it('empty pool, 3 IVs: 4 gap leaves, 3 breeds, cost 100000', () => {
    const g = goal({ hp: 31, atk: 31, def: 31 });
    const plan = buildOptimalPlan([], g, S, getSpecies);
    expect(plan.gaps).toHaveLength(4); // 2^(3-1)
    expect(computePlanCost(plan, S).total).toBe(100000); // 3 breeds*20000 + 4 carriers*10000
  });

  it('owned 2-IV carrier collapses its subtree (3-IV goal): fewer gaps, lower cost', () => {
    const g = goal({ hp: 31, atk: 31, def: 31 });
    const m = mon({ hp: 31, atk: 31 }, 'hpatk');
    const plan = buildOptimalPlan([m], g, S, getSpecies);
    expect(plan.reservedOwnedIds).toContain('hpatk');
    expect(plan.gaps).toHaveLength(2);          // only the non-collapsed subtree's leaves
    expect(computePlanCost(plan, S).total).toBe(60000); // 2 breeds*20000 + 2 carriers*10000
  });

  it('prefers slotting the higher-coverage owned mon when two overlap', () => {
    const g = goal({ hp: 31, atk: 31 });
    const big = mon({ hp: 31, atk: 31 }, 'big');   // covers the whole goal -> done, actually
    const small = mon({ hp: 31 }, 'small');
    const plan = buildOptimalPlan([big, small], g, S, getSpecies);
    // big meets the goal outright -> done
    expect(plan.done).toBe(true);
    expect(plan.reservedOwnedIds).toEqual(['big']);
  });

  it('owned single-IV carrier fills one leaf (2-IV goal), cost 30000', () => {
    const g = goal({ hp: 31, atk: 31 });
    const m = mon({ hp: 31 }, 'hp1');
    const plan = buildOptimalPlan([m], g, S, getSpecies);
    expect(plan.reservedOwnedIds).toContain('hp1');
    expect(plan.gaps).toHaveLength(1);
    expect(computePlanCost(plan, S).total).toBe(30000); // 1 breed 20000 + 1 carrier 10000
  });

  it('produces a structurally valid breeding tree (children = parent minus one pinned attr each)', () => {
    const g = goal({ hp: 31, atk: 31, def: 31 });
    const plan = buildOptimalPlan([], g, S, getSpecies);
    const key = (a: Attribute) => (a.kind === 'iv' ? `iv:${a.stat}` : `nat`);
    const check = (node: PlanNode): void => {
      if (!node.children) return;
      const [pa, pb] = node.newlyPinned!;
      const parent = new Set(node.attributes.map(key));
      const left = new Set(node.children[0].attributes.map(key));
      const right = new Set(node.children[1].attributes.map(key));
      // each child is the parent set minus exactly one pinned attribute
      expect([...parent].filter((k) => !left.has(k))).toEqual([key(pa)]);
      expect([...parent].filter((k) => !right.has(k))).toEqual([key(pb)]);
      check(node.children[0]);
      check(node.children[1]);
    };
    check(plan.root);
  });

  it('is deterministic across calls', () => {
    const g = goal({ hp: 31, atk: 31, def: 31 });
    const pool = [mon({ hp: 31, atk: 31 }, 'fixed')];
    const a = buildOptimalPlan(pool, g, S, getSpecies);
    const b = buildOptimalPlan(pool, g, S, getSpecies);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('assigns deterministic path ids on the tree', () => {
    const g = goal({ hp: 31, atk: 31 });
    const plan = buildOptimalPlan([], g, S, getSpecies);
    expect(plan.root.id).toBe('0');
    expect(plan.root.children![0].id).toBe('0.0');
    expect(plan.root.children![1].id).toBe('0.1');
  });
});
```

- [ ] **Step 2: Run it to confirm failure**

Run: `npm run test:unit -- src/engine/optimalPlan.test.ts`
Expected: FAIL — `buildOptimalPlan` is not exported.

- [ ] **Step 3: Implement the search**

Add to `src/engine/optimalPlan.ts` (imports at top, then the code below):

```ts
import type { FullPlan, PlanGap, PlanNode } from './types';
import type { OwnedPokemon, BreedingGoal } from '../store/types';
import type { PokemonSpecies } from '../data/types';
import { targetAttributes, carriesAttribute, isCompatible, goalMet } from './planner';

/** Defensive bound on search-node expansions before falling back to greedy. */
export const OPTIMIZER_NODE_CAP = 200_000;

class CapExceeded extends Error {}

interface Carrier {
  id: string;
  coverage: number; // bitmask over the goal attribute array
}

// Abstract tree the search returns; rendered into PlanNodes afterwards.
type AbsNode =
  | { kind: 'owned'; ownedId: string }
  | { kind: 'gap'; attrIndex: number }
  | { kind: 'breed'; pinned: [number, number]; left: AbsNode; right: AbsNode };

function popcount(n: number): number {
  let c = 0;
  while (n) { c += n & 1; n >>>= 1; }
  return c;
}

function bitsOf(mask: number): number[] {
  const out: number[] = [];
  for (let i = 0; mask; i++, mask >>>= 1) if (mask & 1) out.push(i);
  return out;
}

export function buildOptimalPlan(
  pool: OwnedPokemon[],
  goal: BreedingGoal,
  settings: Settings,
  getSpecies: (id: number) => PokemonSpecies | undefined,
  nodeCap: number = OPTIMIZER_NODE_CAP,
): FullPlan {
  const attrs = targetAttributes(goal);

  // Short-circuit: an owned mon already satisfies the whole goal.
  const met = pool
    .filter((m) => goalMet(m, goal, getSpecies))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  if (met.length > 0) {
    return {
      goal, done: true, optimal: true,
      root: { id: '0', attributes: attrs, assignedOwnedId: met[0].id },
      reservedOwnedIds: [met[0].id], gaps: [],
    };
  }

  const n = attrs.length;
  const fullMask = (1 << n) - 1;

  // Compatible carriers with their goal-attribute coverage mask. Sorted for determinism.
  const carriers: Carrier[] = pool
    .filter((m) => isCompatible(m, goal, getSpecies))
    .map((m) => ({
      id: m.id,
      coverage: attrs.reduce((acc, a, i) => (carriesAttribute(m, a, goal) ? acc | (1 << i) : acc), 0),
    }))
    .filter((c) => c.coverage !== 0)
    .sort((a, b) => (a.id < b.id ? -1 : 1));

  let nodeCount = 0;
  const memo = new Map<string, { cost: number; node: AbsNode }>();

  const pinCost = (i: number): number => {
    const a = attrs[i];
    if (a.kind === 'iv') return settings.prices[STAT_TO_POWER_ITEM[a.stat]];
    return settings.mechanics.everstoneConsumed ? settings.prices.everstone : 0;
  };

  function solve(mask: number, avail: Carrier[]): { cost: number; node: AbsNode } {
    if (++nodeCount > nodeCap) throw new CapExceeded();
    const key = `${mask}|${avail.map((c) => c.id).join(',')}`;
    const cached = memo.get(key);
    if (cached) return cached;

    let best: { cost: number; node: AbsNode } = { cost: Infinity, node: { kind: 'gap', attrIndex: 0 } };

    // Option A: use an owned carrier that covers `mask` -> cost 0. First (sorted) is fine; see plan notes.
    const coverMon = avail.find((c) => (c.coverage & mask) === mask);
    if (coverMon) {
      best = { cost: 0, node: { kind: 'owned', ownedId: coverMon.id } };
      memo.set(key, best);
      return best; // 0 is optimal for this subtree
    }

    if (popcount(mask) === 1) {
      // Option B: acquire a base carrier.
      best = { cost: settings.prices.baseCarrier, node: { kind: 'gap', attrIndex: bitsOf(mask)[0] } };
      memo.set(key, best);
      return best;
    }

    // Option C: pick two distinct attrs to pin; children = mask minus each.
    const present = bitsOf(mask);
    const relevant = avail.filter((c) => (c.coverage & mask) !== 0);
    for (let xi = 0; xi < present.length; xi++) {
      for (let yi = 0; yi < present.length; yi++) {
        if (xi === yi) continue;
        const x = present[xi];
        const y = present[yi];
        // canonical: only consider x < y to avoid mirror duplicates (left omits x, right omits y)
        if (x > y) continue;
        const breed = pinCost(x) + pinCost(y);
        if (breed >= best.cost) continue;
        const leftMask = mask & ~(1 << x);
        const rightMask = mask & ~(1 << y);

        // Partition relevant carriers across left / right / unused, then solve each side.
        const partition = (idx: number, left: Carrier[], right: Carrier[]): void => {
          if (++nodeCount > nodeCap) throw new CapExceeded();
          if (idx === relevant.length) {
            const lr = solve(leftMask, left);
            if (breed + lr.cost >= best.cost) return;
            const rr = solve(rightMask, right);
            const total = breed + lr.cost + rr.cost;
            if (total < best.cost) {
              best = { cost: total, node: { kind: 'breed', pinned: [x, y], left: lr.node, right: rr.node } };
            }
            return;
          }
          const c = relevant[idx];
          const usefulLeft = (c.coverage & leftMask) !== 0;
          const usefulRight = (c.coverage & rightMask) !== 0;
          if (usefulLeft) partition(idx + 1, [...left, c], right);
          if (usefulRight) partition(idx + 1, left, [...right, c]);
          partition(idx + 1, left, right); // unused on this side of the split
        };
        partition(0, [], []);
      }
    }

    memo.set(key, best);
    return best;
  }

  let abs: AbsNode;
  try {
    abs = solve(fullMask, carriers).node;
  } catch (e) {
    if (e instanceof CapExceeded) {
      const fallback = buildFullPlan(pool, goal, getSpecies);
      return { ...fallback, optimal: false };
    }
    throw e;
  }

  // Render the abstract tree into a PlanNode tree, collecting gaps + reserved ids.
  const gaps: PlanGap[] = [];
  const reserved = new Set<string>();
  const maskToAttrs = (mask: number) => bitsOf(mask).map((i) => attrs[i]);

  const render = (node: AbsNode, mask: number, path: string): PlanNode => {
    if (node.kind === 'owned') {
      reserved.add(node.ownedId);
      return { id: path, attributes: maskToAttrs(mask), assignedOwnedId: node.ownedId };
    }
    if (node.kind === 'gap') {
      const a = attrs[node.attrIndex];
      gaps.push({ nodeId: path, attributes: [a], speciesId: goal.speciesId });
      return { id: path, attributes: [a] };
    }
    const [x, y] = node.pinned;
    const leftMask = mask & ~(1 << x);
    const rightMask = mask & ~(1 << y);
    return {
      id: path,
      attributes: maskToAttrs(mask),
      newlyPinned: [attrs[x], attrs[y]],
      children: [render(node.left, leftMask, `${path}.0`), render(node.right, rightMask, `${path}.1`)],
    };
  };

  const root = render(abs, fullMask, '0');
  return {
    goal, done: false, optimal: true,
    root,
    reservedOwnedIds: [...reserved].sort(),
    gaps,
  };
}
```

Add the `buildFullPlan` import at the top of the file (it is used by the fallback):

```ts
import { buildFullPlan } from './fullPlan';
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npm run test:unit -- src/engine/optimalPlan.test.ts`
Expected: PASS (Task 3 tests + all Task 4 tests). If a cost value mismatches, the bug is in `pinCost`/partition logic — fix until green; the hand-computed totals (40000 / 100000 / 60000 / 30000) are the contract.

- [ ] **Step 5: Commit**

```bash
git add src/engine/optimalPlan.ts src/engine/optimalPlan.test.ts
git commit -m "feat(engine): add buildOptimalPlan exact pool-aware optimizer"
```

---

## Task 5 — Defensive cap & regression oracle

**Files:**
- Modify: `src/engine/optimalPlan.test.ts`
- Modify: `src/engine/index.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/optimalPlan.test.ts`:

```ts
import { buildFullPlan } from './fullPlan';
import { OPTIMIZER_NODE_CAP } from './optimalPlan';

describe('buildOptimalPlan — cap & fallback', () => {
  it('exposes a positive node cap', () => {
    expect(OPTIMIZER_NODE_CAP).toBeGreaterThan(0);
  });

  it('falls back to a valid plan with optimal=false when the cap is hit', () => {
    const g = goal({ hp: 31, atk: 31, def: 31 });
    const plan = buildOptimalPlan([], g, S, getSpecies, 1); // cap of 1 forces fallback
    expect(plan.optimal).toBe(false);
    expect(plan.goal).toEqual(g);
    expect(plan.root).toBeDefined();
  });
});

describe('buildOptimalPlan — regression oracle (optimizer never worse than greedy)', () => {
  const goals: BreedingGoal[] = [
    goal({ hp: 31, atk: 31 }),
    goal({ hp: 31, atk: 31, def: 31 }),
    goal({ hp: 31, atk: 31, def: 31, spa: 31 }),
    goal({ hp: 31, atk: 31 }, { nature: 'Adamant' }),
  ];
  const pools: OwnedPokemon[][] = [
    [],
    [mon({ hp: 31, atk: 31 }, 'p1')],
    [mon({ hp: 31, atk: 31 }, 'p1'), mon({ def: 31 }, 'p2')],
    [mon({ hp: 31, atk: 31, def: 31 }, 'p3')],
  ];

  for (const g of goals) {
    for (const pool of pools) {
      it(`opt <= greedy for ${JSON.stringify(g.targetIVs)}${g.nature ?? ''} / pool ${pool.length}`, () => {
        const opt = buildOptimalPlan(pool, g, S, getSpecies);
        const greedy = buildFullPlan(pool, g, getSpecies);
        expect(computePlanCost(opt, S).total).toBeLessThanOrEqual(computePlanCost(greedy, S).total);
      });
    }
  }
});
```

- [ ] **Step 2: Run it to confirm pass/fail state**

Run: `npm run test:unit -- src/engine/optimalPlan.test.ts`
Expected: The cap/fallback tests pass already (the fallback path was implemented in Task 4). The regression-oracle tests pass if the optimizer is correct. If any `opt <= greedy` fails, the optimizer found a *worse* plan than greedy — a real bug; fix the search before proceeding.

- [ ] **Step 3: Export the new engine API from the barrel**

In `src/engine/index.ts`, add:

```ts
export { buildOptimalPlan, computePlanCost, OPTIMIZER_NODE_CAP } from './optimalPlan';
```

- [ ] **Step 4: Run the full engine suite**

Run: `npm run test:unit -- src/engine`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/optimalPlan.test.ts src/engine/index.ts
git commit -m "test(engine): add cap fallback and optimizer<=greedy regression oracle"
```

---

## Task 6 — Planner-selection adapter (`projectPlannerSelector`)

Produces a `Plan` (the shape `ProjectDetailPage` already consumes) from the optimizer's `FullPlan`:
- `estimate`: pyramid structural counts + `computePlanCost`, with an assumptions line naming the acquisition subtotal.
- `recommendation`: the first performable breed (a breed node whose both children are owned mons), turned into a full `Recommendation` by reusing the exported `validateManualPair`; `null` if none is performable yet.
- `gaps`: each optimizer `PlanGap` attribute mapped to a planner `Gap` with a human description.

**Files:**
- Create: `src/features/projects/projectPlannerSelector.ts`
- Create: `src/features/projects/projectPlannerSelector.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/projects/projectPlannerSelector.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { selectPlanner } from './projectPlannerSelector';
import { buildPlan } from '../../engine/planner';
import { DEFAULT_SETTINGS } from '../../store/defaults';
import type { Settings, OwnedPokemon, BreedingGoal } from '../../store/types';
import type { PokemonSpecies } from '../../data/types';

function getSpecies(id: number): PokemonSpecies | undefined {
  if (id !== 1) return undefined;
  return {
    id: 1, name: 'S1', types: ['normal'], spriteUrl: '',
    eggGroups: ['monster'], genderRate: 4, isGenderless: false,
    femaleRatio: 0.5, abilities: ['Overgrow'], moves: [],
  } as PokemonSpecies;
}
let seq = 0;
function mon(ivs: Partial<OwnedPokemon['ivs']>, gender: 'male' | 'female', id?: string): OwnedPokemon {
  return {
    id: id ?? `m${seq++}`, speciesId: 1,
    ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...ivs },
    nature: 'Hardy', ability: 'Overgrow', isHiddenAbility: false,
    gender, isShiny: false, isAlpha: false, eggMoves: [], createdAt: '2024-01-01T00:00:00.000Z',
  };
}
const goal: BreedingGoal = { speciesId: 1, targetIVs: { hp: 31, atk: 31 } };

const optimizerOn: Settings = {
  ...DEFAULT_SETTINGS,
  features: { ...DEFAULT_SETTINGS.features, costOptimizer: true },
};

describe('selectPlanner', () => {
  it('returns the greedy buildPlan when costOptimizer is off', () => {
    expect(selectPlanner(DEFAULT_SETTINGS)).toBe(buildPlan);
  });

  it('returns a Plan-shaped adapter (not buildPlan) when costOptimizer is on', () => {
    const planner = selectPlanner(optimizerOn);
    expect(planner).not.toBe(buildPlan);
  });

  it('adapter estimate.total matches the optimal plan cost; gaps are described', () => {
    const planner = selectPlanner(optimizerOn);
    const plan = planner([], goal, optimizerOn, getSpecies);
    expect(plan.estimate.cost.total).toBe(40000); // 2-IV fresh: 2 breeds-worth items + 2 carriers
    expect(plan.gaps).toHaveLength(2);
    expect(plan.gaps[0].description).toMatch(/HP|Atk/i);
    expect(plan.recommendation).toBeNull(); // nothing performable from an empty pool
  });

  it('adapter derives a next-breed Recommendation when two owned parents are ready', () => {
    const planner = selectPlanner(optimizerOn);
    const pool = [mon({ hp: 31 }, 'female', 'a'), mon({ atk: 31 }, 'male', 'b')];
    const plan = planner(pool, goal, optimizerOn, getSpecies);
    expect(plan.recommendation).not.toBeNull();
    const ids = [plan.recommendation!.pair.parentAId, plan.recommendation!.pair.parentBId].sort();
    expect(ids).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run it to confirm failure**

Run: `npm run test:unit -- src/features/projects/projectPlannerSelector.test.ts`
Expected: FAIL — `./projectPlannerSelector` does not exist.

- [ ] **Step 3: Implement the adapter**

Create `src/features/projects/projectPlannerSelector.ts`:

```ts
import { buildPlan, validateManualPair } from '../../engine/planner';
import { buildOptimalPlan, computePlanCost } from '../../engine/optimalPlan';
import { attributeCount, baseMonsNeeded, totalBreeds } from '../../engine/pyramid';
import type { Plan, Gap } from '../../engine/planner';
import type { FullPlan, PlanNode, Attribute } from '../../engine/types';
import type { Settings, OwnedPokemon, BreedingGoal } from '../../store/types';
import type { PokemonSpecies } from '../../data/types';

type GetSpecies = (id: number) => PokemonSpecies | undefined;
type PlannerFn = (pool: OwnedPokemon[], goal: BreedingGoal, settings: Settings, getSpecies: GetSpecies) => Plan;

const STAT_LABEL: Record<string, string> = {
  hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe',
};

function describeAttr(attr: Attribute): string {
  return attr.kind === 'iv' ? `${STAT_LABEL[attr.stat]} (31 IV)` : `${attr.nature} nature`;
}

/** Find the first breed node whose both children are already owned mons (performable now). */
function firstPerformableBreed(node: PlanNode): { a: string; b: string } | null {
  if (!node.children) return null;
  const [l, r] = node.children;
  // depth-first, children before parent, so deepest-ready breed surfaces first
  return (
    firstPerformableBreed(l) ??
    firstPerformableBreed(r) ??
    (l.assignedOwnedId && r.assignedOwnedId ? { a: l.assignedOwnedId, b: r.assignedOwnedId } : null)
  );
}

function adapt(full: FullPlan, settings: Settings, pool: OwnedPokemon[], getSpecies: GetSpecies): Plan {
  const n = attributeCount(full.goal);
  const cost = computePlanCost(full, settings);
  const acquisitions = cost.total - cost.powerItems - cost.everstone - cost.abilityPill;

  const gaps: Gap[] = full.gaps.map((g) => ({
    attribute: g.attributes[0],
    description: `Acquire a Pokémon with ${g.attributes.map(describeAttr).join(' + ')}`,
  }));

  let recommendation: Plan['recommendation'] = null;
  const ready = firstPerformableBreed(full.root);
  if (ready) {
    const { candidate } = validateManualPair(ready.a, ready.b, pool, full.goal, settings, getSpecies);
    if (candidate) {
      recommendation = { pair: candidate, alternativesForA: [], alternativesForB: [], warnings: candidate.prediction.warnings };
    }
  }

  return {
    goal: full.goal,
    done: full.done,
    matchingPokemonId: full.done ? full.root.assignedOwnedId : undefined,
    recommendation,
    estimate: {
      attributeCount: n,
      baseMonsNeeded: baseMonsNeeded(n),
      totalBreeds: totalBreeds(n),
      cost,
      assumptions: [
        'Cost-optimized plan (minimum total Pokéyen for the current pool).',
        `Includes ${acquisitions.toLocaleString()} Pokéyen to acquire ${full.gaps.length} base carrier(s).`,
      ],
    },
    gaps,
  };
}

/** Choose the planner based on the costOptimizer feature toggle. */
export function selectPlanner(settings: Settings): PlannerFn {
  if (!settings.features.costOptimizer) return buildPlan;
  return (pool, goal, s, getSpecies) => adapt(buildOptimalPlan(pool, goal, s, getSpecies), s, pool, getSpecies);
}
```

> If `Plan`/`Gap` are not exported from `../../engine/planner` (they are interfaces — confirm), add `export` to them in `planner.ts` in this step. The barrel `../../engine/index` may also re-export them; importing from `planner` directly is safe.

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm run test:unit -- src/features/projects/projectPlannerSelector.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/projects/projectPlannerSelector.ts src/features/projects/projectPlannerSelector.test.ts
git commit -m "feat(projects): add costOptimizer planner-selection adapter"
```

---

## Task 7 — Wire the adapter into `ProjectDetailPage`

**Files:**
- Modify: `src/features/projects/ProjectDetailPage.tsx`

- [ ] **Step 1: Update the import**

In `src/features/projects/ProjectDetailPage.tsx` line 27, change:

```ts
import { buildPlan, validateManualPair } from '../../engine/index';
```

to remove `buildPlan` (now selected via the adapter) and add the selector import. `validateManualPair` stays:

```ts
import { validateManualPair } from '../../engine/index';
import { selectPlanner } from './projectPlannerSelector';
```

- [ ] **Step 2: Use `selectPlanner` in the `useMemo`**

Replace the `useMemo` at lines 484-487:

```ts
const plan = useMemo(
  () => {
    if (!project) return null;
    return selectPlanner(settings)(ownedPokemon, project.goal, settings, getSpeciesById);
  },
  [ownedPokemon, project, settings],
);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: PASS — no type errors. (`selectPlanner(settings)` returns a function with `buildPlan`'s exact signature, so the call site is unchanged in shape.)

- [ ] **Step 4: Run the projects unit tests**

Run: `npm run test:unit -- src/features/projects`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/projects/ProjectDetailPage.tsx
git commit -m "feat(projects): select planner by costOptimizer toggle in ProjectDetailPage"
```

---

## Task 8 — Settings UI: `baseCarrier` price + `costOptimizer` toggle

**Files:**
- Modify: `src/features/settings/SettingsPage.tsx`
- Modify: `e2e/settings.spec.ts`

- [ ] **Step 1: Write the failing e2e test**

In `e2e/settings.spec.ts`, add inside the existing top-level `test.describe('Settings page', ...)` block:

```ts
test('Cost Optimizer toggle and base-carrier price persist and keep the project page working', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await createBulbasaurProject(page, 'Optimizer E2E');

  await page.goto('./#/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  // default off
  await expect(switchInput(page, 'Cost Optimizer')).not.toBeChecked();

  await setNumberInput(page, 'Base Carrier', 20000);
  await clickSwitch(page, 'Cost Optimizer');
  await expect(switchInput(page, 'Cost Optimizer')).toBeChecked();

  await page.reload();
  await expect(switchInput(page, 'Cost Optimizer')).toBeChecked();
  await expect(page.getByLabel('Base Carrier')).toHaveValue('$20,000');

  // project page must render with the optimizer active
  await page.goto('./#/projects');
  await page.getByText('Optimizer E2E').click();
  await expect(page.getByRole('heading', { name: 'Optimizer E2E' })).toBeVisible();
});
```

- [ ] **Step 2: Run it to confirm failure**

Run: `npm run test:e2e -- e2e/settings.spec.ts`
Expected: FAIL — no "Cost Optimizer" switch and no "Base Carrier" input.

- [ ] **Step 3: Add the `baseCarrier` price input**

In `src/features/settings/SettingsPage.tsx`, add `baseCarrier` to `FEE_KEYS` and a label in `FEE_LABELS` (lines 21-38):

```ts
const FEE_LABELS: Partial<Record<PriceKey, string>> = {
  genderFeeBase: 'Gender fee (1:1 ratio)',
  genderFeeMax: 'Gender fee (7:1 ratio)',
  abilityPill: 'Ability Pill',
  baseCarrier: 'Base Carrier (per acquired carrier)',
};

const FEE_KEYS: PriceKey[] = ['genderFeeBase', 'genderFeeMax', 'abilityPill', 'baseCarrier'];
```

(The existing rendering loop over `FEE_KEYS` will produce the NumberInput. The e2e uses `getByLabel('Base Carrier')`, a substring match on this label.)

- [ ] **Step 4: Add the `costOptimizer` Switch**

In the Feature Toggles card, after the `alpha` `<Switch>` (around line 248), add:

```tsx
<Switch
  label="Cost Optimizer"
  description="Use the minimum-total-cost planner instead of the greedy next-step heuristic (experimental)."
  checked={settings.features.costOptimizer}
  onChange={(e) => updateFeatures({ costOptimizer: e.currentTarget.checked })}
/>
```

- [ ] **Step 5: Run the e2e to confirm it passes**

Run: `npm run test:e2e -- e2e/settings.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/SettingsPage.tsx e2e/settings.spec.ts
git commit -m "feat(settings): expose baseCarrier price and costOptimizer toggle in Settings UI"
```

---

## Task 9 — Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the whole gate**

Run: `npm run test:unit && npm run test:e2e && npx tsc -b && npx eslint .`
Expected: all green. If `eslint` flags unused imports introduced by the edits (e.g. a now-unused `buildPlan` import), remove only those orphaned by this work.

- [ ] **Step 2: Commit any lint fixups**

```bash
git add -A
git commit -m "chore: lint/type fixups for cost optimizer"
```

---

## Notes on the search (for the implementer)

- **Why first-covering-mon is safe (Task 4, Option A).** Once a node's set `S` is covered by an owned mon, the whole subtree terminates at cost 0 — the best possible for that subtree. Which covering mon is picked matters only relative to *sibling* subtrees, and that contention is already resolved by the parent split's carrier partition. So picking the first (sorted) covering mon is both optimal and deterministic.
- **Determinism.** Carriers are sorted by id; splits are enumerated in a fixed order; ties keep the first-found plan. `JSON.stringify` equality across runs is asserted.
- **Complexity.** Pure subset DP is `O(3^n)` over `≤7` attributes (instant). The carrier partition multiplies by `3^(relevant carriers)` per split; the `OPTIMIZER_NODE_CAP` bounds pathological pools and triggers the greedy fallback (`optimal=false`).

## Self-review notes (author)

- Spec coverage: pool-aware ✓ (carriers + partition), provably optimal ✓ (exact recursion) with cap+fallback ✓ (Task 4/5), full-plan output ✓ (`FullPlan`), next-step derived ✓ (Task 6 adapter), feature toggle ✓ (Tasks 1/8), cost = breeding + acquisition ✓ (Task 3 + `baseCarrier`), deterministic model ✓ (gender/Ditto = 0, documented).
- Type consistency: `buildOptimalPlan` signature identical across Tasks 4/5/6; `computePlanCost(plan, settings)` used consistently; `selectPlanner` returns `buildPlan`'s signature so the call site is shape-stable.
- Known v1 simplification (flag at review): plan `estimate.cost` has no dedicated acquisition line, so `total` exceeds the itemized lines by the acquisition subtotal, which is stated in `estimate.assumptions`. Gender fees / Ditto are 0 in the plan estimate (the next-breed card still prices them via `computeStepCost`).
