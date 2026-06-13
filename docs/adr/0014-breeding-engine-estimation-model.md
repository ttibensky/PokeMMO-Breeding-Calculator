# Breeding-engine estimation & planning model

* Status: accepted
* Deciders: build team (orchestrator + subagents)
* Date: 2026-06-13

Technical Story: Milestone 5 of SPEC.md — the pure breeding engine (`src/engine/`). Refines [ADR-0009](0009-adaptive-replanning-breeding-engine.md) and [ADR-0010](0010-editable-default-prices-cost-model.md) with the concrete formulas chosen, since several depend on numbers the mechanics doc flags as uncertain.

## Context and Problem Statement

The engine must validate pairs, predict offspring distributions, estimate goal cost/breed-count, and recommend the next pair. `docs/breeding-mechanics.md` gives high-confidence rules for some mechanics and explicit "[verify in-game]" uncertainty for six others. We need committed formulas that are correct where the doc is confident and *configurable* where it is not, plus a planner that is tractable rather than globally optimal.

## Decision Drivers

* Match mechanics §6 pyramid table exactly (high-confidence, directly tabulated).
* Keep the six uncertain numbers in `Settings.mechanics`/`prices` (editable), never hard-coded.
* Communicate that projections are estimates (inheritance is probabilistic).
* Tractability: a greedy best-next-pair, not an NP-hard global tree optimizer.

## Considered Options

* **Greedy heuristic planner + pyramid-based cost estimate** (chosen).
* Full search/optimization over all possible breeding trees — correct-optimal but exponential and overkill for a planning aid.
* Hard-code all mechanic numbers — simpler but un-correctable when the community confirms real values.

## Decision Outcome

Chosen: a **pure, layered engine** (`pyramid`, `validation`, `inheritance`, `cost`, `planner`) with these formulas:

- **Attributes & pyramid:** `attributeCount = (#target IVs equal to 31) + (nature ? 1 : 0)`; `baseMonsNeeded = 2^(n−1)`, `totalBreeds = 2^(n−1) − 1` (matches §6 for n=2..6). Ability/gender/shiny do NOT multiply the tree.
- **IV inheritance (per non-pinned stat marginal):** 2 Power items → `ivPassChanceTwoItems` (0.125/0.75/0.125); 1 → `ivPassChanceOneItem` (0.2/0.6/0.2); 0 → 0.25/0.5/0.25 (documented marginal approximation of the "3 inherited + 3 averaged" rule — the 0-item path is not the competitive case). Power items pin their stat to the holder (p=1). All read from `Settings.mechanics`.
- **Nature:** Everstone carries the holder's nature at `everstoneGuaranteed ? 1 : 0.5`.
- **Ability/HA:** propagates from the female-role parent at `mechanics.abilityPassRate` (default 0.8); HA only via a female-role HA carrier.
- **Cost:** `powerItems = breeds × 2 × averagePowerItemPrice`; `everstone = nature ? (everstoneConsumed ? attributes−1 : 1) × price : 0` (nature lineage carried up the tree height); `genderFees = (!genderless && goal.gender) ? breeds × scaledGenderFee : 0` where `scaledGenderFee` interpolates base↔max by `skew = clamp(|0.5 − femaleRatio| / 0.375, 0, 1)` (0 at 1:1, 1 at 7:1); `ditto = genderless ? breeds × price : 0`; `abilityPill = (ability && !requireHiddenAbility) ? price : 0`.
- **Planner:** greedy best-next-pair. Score = #guaranteed target-31 stats merged in the child (+1 if the nature is carried), tie-broken by real progress beyond either parent then lowest step cost. Power items pin each parent's most valuable distinct target stat; `forcedGender` is `goal.gender` on the final breed, `'female'` on intermediate non-genderless breeds, `undefined` for Ditto lines. Returns `null` when no valid pair makes progress; `gaps` enumerate uncovered target attributes.

### Positive Consequences

* Pyramid/cost outputs reproduce mechanics §6 exactly (verified in tests).
* All six uncertain mechanics are editable in Settings without touching engine code.
* Engine is pure and decoupled (`getSpecies` injected), 334 unit tests cover tables and edge cases.

### Negative Consequences

* The 0-Power-item marginal is an approximation (acceptable; competitive breeding uses Power items).
* `everstone = attributes−1` is one defensible interpretation of "carried up every layer"; surfaced in `GoalEstimate.assumptions`.
* `possibleEggMoves` are returned lowercased (case-insensitive match artifact) — cosmetic, behind the default-off egg-move feature; to be tidied in polish if it surfaces in the UI.
* The greedy planner can be non-optimal for unusual pools; projections are explicitly estimates.

## Links

* Refines [ADR-0009](0009-adaptive-replanning-breeding-engine.md), [ADR-0010](0010-editable-default-prices-cost-model.md)
* Implements SPEC.md §6, §7; encodes `docs/breeding-mechanics.md` §2–§9, §11 and the six open questions as `Settings.mechanics`.
