# Adaptive re-planning breeding engine (best-next-pair)

* Status: accepted
* Deciders: Tomas Tibensky, Claude (orchestrator)
* Date: 2026-06-13

## Context and Problem Statement

PokeMMO IV inheritance is probabilistic: exactly 3 IVs are inherited and 3 are averaged; Power items pin one stat per parent (non-pinned stats resolve high/avg/low at ~20/60/20 with one Power item, ~12.5/75/12.5 with two); both parents are permanently consumed each breed; nature is carried via Everstone. Because real results vary from any prediction, should the engine precompute a full breeding tree up front, or re-plan after each reported result?

## Decision Drivers

* Rigid precomputed trees break whenever RNG diverges from the expected path.
* The user needs a concrete "breed these two next" recommendation at each step, not just a plan diagram.
* Progress tracking and cost estimates must stay accurate as reality diverges from the original projection.
* Manual parent overrides (user picks parents themselves) must remain supported.

## Considered Options

* (a) Precompute a full static breeding tree up front and follow it.
* (b) Adaptive engine: given the current owned pool + goal, compute the best next pairing and a projected remaining plan, re-planning whenever the user reports a real result.

## Decision Outcome

Chosen option: "(b) Adaptive engine", because a static tree becomes invalid the moment RNG produces an off-plan baby, which is the common case.

The engine takes as input the current owned Pokémon pool and the breeding goal, and outputs:

* The recommended next pair — including held items, required genders, and which candidates from the pool qualify.
* A projected count of remaining breeds and total estimated cost.
* An overall plan shape derived from the standard pyramid: 2^(N−1) base mons and 2^(N−1)−1 breeds for N perfect IVs.

When the user reports the resulting baby (or manually selects parents), the engine re-plans from the updated pool. Manual parent overrides are fully supported — the engine accepts whatever pool state the user provides.

### Positive Consequences

* Robust to RNG: no step requires a specific baby that may never appear.
* Unifies next-step recommendation, cost estimate, and progress tracking into one coherent engine.
* Supports manual parent override without special-casing.
* Projections tighten as the pool improves, giving the user useful feedback throughout.

### Negative Consequences

* More complex algorithm than a one-time tree generator.
* Projections are estimates, not guarantees; the UI must communicate this uncertainty clearly.
* Re-planning on every reported result adds latency; must remain fast enough for interactive use.

## Pros and Cons of the Options

### (a) Precompute a full static breeding tree

* Good, because the full plan is visible up front — user can see every step before starting.
* Good, because implementation is straightforward: generate tree once, traverse it.
* Bad, because a single off-plan baby invalidates downstream steps and can make the plan impossible to complete.
* Bad, because cost and progress figures go stale the moment reality diverges.
* Bad, because manual parent overrides require regenerating the tree anyway.

### (b) Adaptive engine (chosen)

* Good, because the plan always reflects the actual current pool, not a hypothetical one.
* Good, because cost and remaining-breed estimates are continuously accurate.
* Good, because manual overrides require no special handling — just update the pool and re-plan.
* Bad, because the algorithm is more involved than single-shot tree generation.
* Bad, because individual step projections carry inherent uncertainty that must be surfaced to the user.

## Links

* Consumes [ADR-0007](0007-bundled-static-species-dataset.md) (species data) and [ADR-0008](0008-data-model.md) (data model).
* Cost figures produced by this engine use prices from [ADR-0010](0010-editable-default-prices-cost-model.md).
