# What-If Breeding Simulator — Design (Draft)

**Date:** 2026-06-14
**Status:** Draft — idea captured during brainstorm; needs full design before planning
**Tier:** 3 (high value, higher complexity; build on a well-tested engine)

## Goal

Let users try breeding scenarios — different parent pairs, held items, RNG
outcomes — without committing anything to a real project. A sandbox.

## Context (what we know)

- Offspring prediction and inheritance live in `src/engine/inheritance.ts`
  (`predictOffspring`, IV distribution, gender logic); pair validity in
  `src/engine/validation.ts` (`validatePair`); cost in `src/engine/cost.ts`.
- The engine is pure functions with no UI dependency — well suited to driving a
  sandbox that doesn't touch the persisted store.

## Rough approach

- A simulator screen where the user picks two parents (from pool or hypothetical),
  assigns held items / Everstone / forced gender, and sees predicted offspring
  outcomes and cost — all in transient state, never written to a project.
- Optionally chain simulated offspring as parents for the next simulated step.

## In scope

- Transient, non-persisted what-if evaluation using the existing pure engine.

## Out of scope (for now)

- Saving a simulation as a real project (could be a "promote to project" follow-up).
- Monte-Carlo RNG distribution analysis (start with deterministic best/expected
  outcomes).

## Open questions

- Single-pair calculator first, or multi-step chained sandbox from the start?
- Should it show outcome probabilities, or just the deterministic prediction?
- Can simulated/hypothetical parents be created on the fly, or only pool members?

## Complexity / risk

Higher. The engine primitives exist, but a chained, interactive sandbox is real
UI/state surface. Best after the engine is exercised by the tree visualization
and gap features.
