# Whole-Project Cost Optimization — Design (Draft)

**Date:** 2026-06-14
**Status:** Draft — idea captured during brainstorm; needs full design before planning
**Tier:** 3 (highest value, highest risk — tackle last)

## Goal

Replace the greedy best-next-pair heuristic with a planner that minimizes the
*total* Pokéyen cost to reach a project's goal, not just the cost of the next
step.

## Context (what we know)

- Current planner: `src/engine/planner.ts` (`buildPlan`) is a greedy heuristic —
  it picks the best immediate pair, which can be globally suboptimal.
- Supporting pure functions: `inheritance.ts` (predict offspring/IV distribution),
  `cost.ts` (`estimateGoal`, `computeStepCost`), `validation.ts`,
  `compatiblePool.ts`, `pyramid.ts`.
- All engine logic is pure and unit-testable, which is essential for safely
  swapping the core algorithm.

## Rough approach

- Model the goal as a search/optimization problem over breeding trees: enumerate
  viable parent combinations and choose the tree with minimum total cost.
- Likely a bounded search (the IV/nature/ability target space is constrained —
  classic breeding pyramids have known optimal shapes) rather than unbounded.
- Keep the greedy planner as a fallback/baseline and gate the optimizer behind
  thorough comparison tests (optimizer cost ≤ greedy cost on a corpus of goals).

## In scope

- A globally cost-minimizing planner for a single project goal, with the existing
  cost model as the objective.

## Out of scope (for now)

- Cross-project joint optimization (sharing intermediates between projects).
- Optimizing for time/effort rather than Pokéyen (cost only for v1).

## Open questions

- What's the exact search space and a tractable algorithm (DP over the IV
  pyramid? branch-and-bound?) given 2–6 target stats + nature + ability?
- Acceptable planning latency in-browser for the worst case (6×31 + nature +
  hidden ability)?
- Does "optimal" need to respect the current pool, or assume ideal acquisitions?

## Complexity / risk

High. Replaces the core algorithm; correctness and performance both matter.
Strongly prefer doing this **after** the breeding tree visualization (to make
output legible) and with a large regression corpus comparing against greedy.
