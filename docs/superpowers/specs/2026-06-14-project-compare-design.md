# Side-by-Side Project Compare — Design (Draft)

**Date:** 2026-06-14
**Status:** Draft — idea captured during brainstorm; needs full design before planning
**Tier:** 2 (useful once juggling many projects)

## Goal

Compare multiple breeding projects together — total cost, progress, and shared
Pokémon — to help the user decide what to work on next.

## Context (what we know)

- Projects + plans: `src/store/projectsSlice.ts`. Cost estimation:
  `src/engine/cost.ts` (`estimateGoal`). Progress is tracked via reported step
  results.
- The Projects list (`src/features/projects/ProjectsPage`) shows projects but not
  a comparative view.

## Rough approach

- A compare view (select 2–N projects) presenting a side-by-side table:
  estimated total cost, steps remaining, % complete, gaps count, and Pokémon
  shared across the selected projects (ties into the reservation concept).
- Reuse existing per-project cost/progress computations rather than new math.

## In scope

- A read-only comparison table over selected existing projects.

## Out of scope (for now)

- Recommending an optimal *order* to execute projects.
- Merging or batch-editing projects from the compare view.

## Open questions

- Where does it live: a "Compare" mode on the Projects page, or a dedicated route?
- Which metrics matter most for the decision (cost? time? shared pool pressure?)?
- How many projects can be compared at once before the table gets unwieldy?

## Complexity / risk

Moderate. Mostly aggregation/presentation of existing per-project data. Shared-
Pokémon detection overlaps with the Pool Reservation feature — consider ordering
them together.
