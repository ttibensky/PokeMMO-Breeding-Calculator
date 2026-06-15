# Full-Plan Engine — Design

**Date:** 2026-06-15
**Status:** Ready for planning
**Tier:** 2 (foundational engine capability; unblocks two downstream features)

## Goal

Add a pure engine function that, given the current owned pool + a project goal +
settings, produces a **complete forward breeding plan**: the whole tree from
leaves up to the goal target. Today `buildPlan()` only exposes an aggregate cost
estimate and a *single* next-step recommendation — there is no full multi-step
plan that assigns owned Pokémon to future steps.

This engine is the foundational prerequisite for two downstream features that
were each blocked on it:

- **Breeding Tree Visualization** — renders the full tree this engine produces.
- **Pool Reservation View** — derives, per owned Pokémon, which projects consume
  it (the engine's `reservedOwnedIds`), flagging cross-project conflicts.

Both were drafted assuming a full plan already existed; it does not. This spec
builds it.

## Background: why top-down is clean here

The IV inheritance model (`src/engine/inheritance.ts`) does **not** model the
destiny knot. A stat is guaranteed 31 in the child only when:

- **both parents are 31** in that stat (`statDistribution` collapses to a single
  31 outcome, p=1), or
- the stat is **pinned by a Power item** (one held-item slot per parent).

Nature is guaranteed via **Everstone** (also a held-item slot) or for free once
both parents carry it. There are two held-item slots per breed (one per parent).

This makes the backward decomposition canonical: a node guaranteeing attribute
set `S` of size *k* splits into two parents `S\{x}` and `S\{y}` that share `k−2`
attributes (guaranteed free because both carry them), with the two differing
attributes `x` and `y` each pinned by one held item — never more than the two
slots allow. Recursing to single-attribute leaves yields `2^(N−1)` leaves —
exactly what `src/engine/pyramid.ts` already counts via `baseMonsNeeded`.

## Approach (decisions, settled)

- **Source of reservation:** the full tree (this engine). Reservation is not the
  shallow single-next-step signal.
- **Algorithm:** top-down pyramid decomposition (clean symmetric template), not
  forward-simulation of the greedy recommender.
- **Owned placement:** slot owned mons as high as they fit and prune the subtree
  beneath them.
- **State:** pure / derived. No new persisted state; recomputed on demand, same
  contract style as `buildPlan`. Reservations recompute live as the pool changes.

## Architecture

### Placement

New pure function in a new file:

```ts
// src/engine/fullPlan.ts
export function buildFullPlan(
  pool: OwnedPokemon[],
  goal: BreedingGoal,
  settings: Settings,
  getSpecies: (id: number) => PokemonSpecies | undefined,
): FullPlan;
```

It is **additive** — it does not replace `buildPlan()`. (Future, out of scope:
`buildPlan()` could derive its `recommendation` from this plan's first actionable
breed so the app speaks with one "next step" voice.)

### Attribute model

An **attribute** is one target IV stat or the nature — exactly what
`attributeCount(goal)` counts. Ability, gender, shininess, and egg moves are
**not** pyramid attributes; they remain side-constraints on the final / leaf
breeds, handled as they are today (`goalMet`, `assignItems`, `buildCandidate`).

A node is described by its `AttributeKey[]` — the subset of goal attributes it
guarantees. The root node carries all goal attributes.

### Top-down template (the only genuinely new logic)

`buildPyramidSpec(attributes)` recursively splits node `S` (size *k* ≥ 2) into:

- `A = S \ {x}` and `B = S \ {y}`, where `x` and `y` are two distinct attributes
  of `S` chosen by a **deterministic canonical order** (target IV stats in a
  fixed stat order, nature last).

Leaves are single-attribute nodes (`k = 1`). The differing attributes `x`, `y`
are recorded on the breed node as its **newly pinned** attributes (the two held
items that breed needs) — enough for downstream display without resolving exact
`ItemKey`s here.

**Correctness is cross-checked against the existing forward predictor.** For every
generated breed node, materialize the two child specs with their pin items and
assert `computeGuaranteedTargetStats(...) ⊇ S`. This is both an invariant and the
core unit-test strategy — the new backward logic is validated by the trusted
forward model.

### Owned placement: slot-high + prune

Walk the template top-down (largest nodes first). At node `S`:

- If any **unassigned, breeding-compatible** owned mon carries *all* of `S` —
  `S.every(a => carriesAttribute(mon, a, goal)) && isCompatible(mon, goal,
  getSpecies)` — **assign it to the node and prune the subtree**. The mon is a
  ready-made input; mark it consumed.
- Otherwise keep the node as a **breed step** and recurse into its two children.
- A single-attribute leaf with no owned match becomes a **gap** (acquire a mon
  carrying that attribute, of a compatible species).

Assignment is **greedy** with a **minimal-surplus tie-break**: among owned mons
that cover a node, prefer the one with the fewest *extra* target attributes, so
stronger mons are conserved for nodes that need them. Optimal (e.g. Hungarian)
assignment is explicitly **out of scope** (YAGNI) — consistent with the existing
greedy recommender.

### Output

```ts
interface FullPlan {
  goal: BreedingGoal;
  done: boolean;                   // an owned mon already meets the goal
  root: PlanNode;
  reservedOwnedIds: string[];      // current owned mons this plan consumes
  gaps: PlanGap[];                 // leaves needing acquisition
}

interface PlanNode {
  id: string;                      // stable, derived from attribute set + tree path
  attributes: AttributeKey[];      // what this node guarantees
  assignedOwnedId?: string;        // set iff a current owned mon fills this node
  newlyPinned?: [AttributeKey, AttributeKey]; // the two attributes this breed pins
  children?: [PlanNode, PlanNode]; // present iff this is a breed step
}

interface PlanGap {
  nodeId: string;
  attributes: AttributeKey[];      // the single attribute to acquire
  speciesId: number;               // a breeding-compatible species to look for
}
```

- **Breed step** = a node with `children` and no `assignedOwnedId`.
- **Reservation** (Pool Reservation View) reads `reservedOwnedIds`; a mon in two
  projects' sets is a cross-project conflict.
- **Tree** (Breeding Tree Visualization) reads `root`.

## Reused helpers (no re-derivation)

| Need | Existing helper | Location |
| --- | --- | --- |
| Does a mon meet the whole goal | `goalMet` | `src/engine/planner.ts:120` |
| Does a mon carry one attribute | `carriesAttribute` | `src/engine/planner.ts:169` |
| Enumerate goal attributes | `targetAttributes` | `src/engine/planner.ts` |
| Breeding compatibility | `isCompatible` / `validatePair` / `sharedEggGroup` | `src/engine/planner.ts:152`, `src/engine/validation.ts:24,15` |
| Forward guarantee (cross-check) | `predictOffspring` / `computeGuaranteedTargetStats` | `src/engine/inheritance.ts:122`, `src/engine/planner.ts:293` |
| Attribute / base-mon / breed counts | `attributeCount` / `baseMonsNeeded` / `totalBreeds` | `src/engine/pyramid.ts:9` |
| Aggregate cost (unchanged) | `estimateGoal` | `src/engine/cost.ts:44` |

The **only** new logic is the backward decomposition (`buildPyramidSpec`) and the
slot-high-and-prune walk.

## In scope

- `buildFullPlan` producing the tree structure, owned-Pokémon assignments,
  `reservedOwnedIds`, and acquisition gaps.
- The backward decomposition, verified against the forward predictor.
- Unit tests (Vitest).

## Out of scope (deferred — YAGNI)

- **Per-node held-item `ItemKey`s, forced gender, and per-step cost.** Structure,
  assignments, and gaps do not need them, and resolving them tree-wide duplicates
  `assignItems` / `buildCandidate`. The breed node records `newlyPinned`
  attributes, so Tree Visualization can resolve display items via existing helpers
  as a thin follow-up.
- **Optimal owned-mon assignment** (greedy + minimal-surplus tie-break is v1).
- **Unifying `buildPlan`'s next-step** with this plan's first actionable breed.
- The downstream views themselves (Breeding Tree Visualization, Pool Reservation
  View) — each gets its own spec built on this engine.

## Edge cases & termination

- Finite recursion bounded by attribute count (≤ ~6).
- `done` (an owned mon meets the goal) → `root` assigned to that mon, no breed
  steps, no gaps, `reservedOwnedIds = [thatMon]`.
- `N = 0` or `N = 1` attributes → trivial single-leaf tree.
- Deterministic node `id`s and attribute ordering, so the tree is stable across
  recomputes (required for stable reservations and stable rendering).

## Testing

Pure function → **unit tests** (Vitest, co-located `src/engine/fullPlan.test.ts`):

- Symmetric pyramid for an empty pool → all leaves are gaps; `2^(N−1)` of them.
- Slot-high pruning: a multi-attribute owned mon is assigned high and its subtree
  is pruned; deeper nodes/gaps shrink accordingly.
- Full prune when an owned mon already meets the goal (`done = true`).
- Gap species compatibility (`speciesId` is breeding-compatible with the goal).
- Deterministic node `id`s and attribute order across repeated calls.
- `reservedOwnedIds` lists exactly the assigned owned mons.
- **Forward-predictor cross-check**: every breed node's materialized children
  guarantee its attribute set.

No e2e — the engine is non-visual. The consuming views get e2e coverage when they
are built.

## Complexity / risk

Moderate. Most building blocks already exist and are reused. The single risk area
is the backward decomposition's correctness, which is mitigated by validating
every generated breed against the existing, trusted forward predictor.
