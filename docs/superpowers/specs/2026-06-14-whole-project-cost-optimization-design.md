# Whole-Project Cost Optimization — Design

**Date:** 2026-06-14
**Status:** Designed — ready for implementation planning
**Tier:** 3 (highest value, highest risk)

## Goal

Add a planner that computes the **provably minimum total Pokéyen cost** to reach a
single project's goal, **reusing the owned pool** and paying only to acquire the
base carriers that are missing. It replaces the greedy best-next-pair heuristic's
*decision quality* — not its place in the UI — and is gated behind a feature
toggle so greedy and optimizer coexist.

The optimizer produces a **full breeding tree** (the existing `FullPlan` shape);
the live "next recommendation" becomes the first actionable node of that tree.

## Decisions (resolved during brainstorm)

| Question | Decision |
|---|---|
| Optimize against current pool or ideal acquisitions? | **Pool-aware** — reuse owned Pokémon as carriers; pay only for gaps. |
| Output shape? | **Full plan** (`FullPlan`); derive the next-step recommendation from its root. |
| Optimality guarantee? | **Provably optimal** (exact search) for all realistic inputs, with a defensive cap + safe fallback. |
| Coexistence with greedy? | **Feature toggle** — both planners live; greedy also retained as a test baseline. |
| Cost components? | **Breeding costs + carrier acquisition** (new flat `baseCarrier` price). |

## Cost model

Total cost the optimizer minimizes:

1. **Per-breed costs** — reuse `computeStepCost(a, b, heldItems, forcedGender,
   settings, getSpecies)` verbatim: power items (one per pinned stat per parent),
   everstone (if `mechanics.everstoneConsumed`), scaled gender fee, Ditto.
2. **Ability** — additive constant `prices.abilityPill`, applied once if the goal
   requires a non-default ability. **Not** part of the tree search (ability is not
   a tree attribute; only IVs + nature are — see `attributeCount`).
3. **Carrier acquisition** — a new flat price **`baseCarrier`** charged per
   single-attribute base Pokémon the plan must acquire to fill a gap. Owned
   carriers cost 0.

**Modeling assumption (deterministic cost):** the cost model is the existing
guaranteed-item path — power items pin IVs, everstone pins nature, so there are no
failure re-rolls. This matches the current `pyramid.ts` / `cost.ts` engine. We do
**not** model probabilistic expected cost in v1.

## Architecture & integration

### New module
`src/engine/optimalPlan.ts`:

```ts
buildOptimalPlan(
  pool: OwnedPokemon[],
  goal: BreedingGoal,
  settings: Settings,
  getSpecies: (id: number) => PokemonSpecies | undefined,
): FullPlan
```

Note the extra `settings` parameter (vs. the existing `buildFullPlan`, which does
not cost-weight): the optimizer prices every candidate, so it needs `settings`.

### Reused types
The optimizer emits the **existing** `FullPlan` / `PlanNode` / `PlanGap` types
(`src/engine/types.ts:57-80`) so it is a drop-in for the same downstream and
unlocks the separate breeding-tree-visualization feature later:

- `PlanNode`: `id`, `attributes`, `assignedOwnedId?`, `newlyPinned?`, `children?`.
- `FullPlan`: `goal`, `done`, `root`, `reservedOwnedIds`, `gaps`.

**One additive extension:** `FullPlan` gains `optimal: boolean` — `true` in the
normal case; `false` only if the defensive cap trips and we fall back (see
*Algorithm*).

### Wiring
- `src/features/projects/ProjectDetailPage.tsx:27` selects the planner by the new
  `features.costOptimizer` toggle:
  - **on** → `buildOptimalPlan`; derive the next recommendation from `root`'s first
    actionable (leaf-ready) breed.
  - **off** → today's `buildPlan` (greedy next-step), unchanged.
- The existing greedy slot-high `buildFullPlan` (`src/engine/fullPlan.ts`) is
  **retained as a test baseline**, not deleted and not wired to the UI.

## Algorithm (provably optimal + safe cap)

### Core — subset DP over goal-attribute subsets
The goal is a set `G` of attributes (≤6 IVs + optional nature ⇒ ≤7 attributes ⇒
≤128 subsets). Define:

- `cost(S)` = minimum cost to obtain a Pokémon carrying exactly attribute-set `S`.
- `|S| = 1`: `prices.baseCarrier` (acquire), or `0` if an owned single-attribute
  carrier is available for that attribute.
- `|S| ≥ 2`: `min` over all partitions `(A, B)` of `S` of
  `cost(A) + cost(B) + breedCost(A, B)`, where `breedCost` is computed from the
  `computeStepCost` primitives (power items to pin the kept stats + gender fee +
  everstone if nature ∈ `S`).

This DP is **exact** for the acquire-fresh relaxation (~3⁷ ≈ 2187 work units →
microseconds) and serves as an **admissible lower bound** for the pool-aware
search below.

### Pool-aware layer (the hard part)
Each owned Pokémon is reusable **at most once** and may cover a *multi-attribute*
subtree (cost 0 when slotted at the node for the attributes it carries). That
once-per-individual constraint makes this a set-packing-flavored search rather
than a clean DP.

Approach: **branch-and-bound** over which owned carriers to slot at which tree
nodes, using the subset-DP cost as the admissible lower bound to prune, with
memoization on the remaining sub-problem. In practice only owned Pokémon carrying
**≥2 goal attributes** are worth slotting above leaf level (a 1-attribute owned
mon is just a free leaf), so the effective branching factor is small for realistic
pools, and the search terminates quickly.

### Defensive cap & fallback
A node/time budget bounds the branch-and-bound. For all realistic inputs it never
trips and the returned plan is provably optimal (`optimal: true`). If a
pathological input ever exceeds the budget, the optimizer returns the greedy
`buildPlan`-equivalent plan with `optimal: false`, and the UI surfaces that the
plan is not guaranteed optimal. **We never silently return a non-optimal plan
labeled optimal.**

## Settings changes

- `FeatureToggles` (`src/store/types.ts`) gains a 5th flag **`costOptimizer`**,
  default **off**.
- `PriceKey` gains **`baseCarrier`**; `DEFAULT_SETTINGS.prices.baseCarrier`
  defaults to **¥10,000**, editable at `/#/settings`.

## Testing (the correctness gate)

- **Unit (`src/engine/optimalPlan.test.ts`):**
  - Hand-verified small cases (1–3 attributes) with known optima.
  - Pool reuse collapses a subtree (owned multi-attribute carrier slotted high).
  - Gap creation when an attribute has no carrier.
  - Deterministic output (stable tie-breaking).
- **Regression / A-B oracle:** across many generated `(pool, goal)` cases assert
  **`optimizerCost ≤ greedyCost`** (never worse than greedy), and feed the
  optimizer's tree back through the existing forward predictor to confirm it
  actually yields the goal (mirrors the existing "cross-check decomposition vs
  forward predictor" test).
- **Cost identity (property):** `FullPlan` total equals the sum of per-node
  `computeStepCost` + acquisitions + (ability pill if required), with no
  double-counting.
- **Settings / UI:**
  - Unit: toggle-driven planner selection in the page's `useMemo`.
  - e2e (Playwright, hash route `/#/projects/:id`, scoped selectors): flipping
    `costOptimizer` in `/#/settings` changes the plan shown for a seeded project.

## In scope

- A pool-aware, provably-optimal full-plan planner for a single project goal.
- New `costOptimizer` feature toggle and `baseCarrier` price.
- `optimal` flag on `FullPlan` + fallback path.

## Out of scope

- Cross-project joint optimization (sharing intermediates between projects).
- Optimizing for time/effort rather than Pokéyen.
- Probabilistic / expected-cost modeling (re-rolls for failed inheritance).
- New tree-visualization UI (separate feature; this design only emits the data).

## Risks

- **Search blow-up on large pools** — mitigated by the ≥2-attribute candidate
  filter, subset-DP lower-bound pruning, memoization, and the defensive cap.
- **Cost-model drift** — mitigated by reusing `computeStepCost` rather than
  re-deriving per-breed cost, and the cost-identity property test.
- **Regression vs greedy** — mitigated by the `optimizerCost ≤ greedyCost` oracle
  over a large generated corpus.
