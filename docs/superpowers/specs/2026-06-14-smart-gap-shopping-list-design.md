# Smart Gap Shopping List — Design (Draft)

**Date:** 2026-06-14
**Status:** Draft — idea captured during brainstorm; needs full design before planning
**Tier:** 1 (high value, extends existing concept)

## Goal

When the owned pool can't reach a project's goal, tell the user *exactly* what to
acquire — which species, with which nature / ability / IVs — and the cheapest way
to fill each gap, instead of just flagging that a gap exists.

## Context (what we know)

- A **Gaps** concept already exists: the plan surfaces target attributes (nature,
  ability, egg moves) for which the pool has no compatible carrier.
- Relevant engine code: `src/engine/planner.ts` (`buildPlan`),
  `src/engine/compatiblePool.ts` (`getCompatibleSpecies` for gap analysis),
  `src/engine/cost.ts` (`estimateGoal`, cost math).
- Cost inputs (item prices, Ditto, Ability Pill, Everstone, etc.) are configurable
  in Settings via `settingsSlice.ts`.

## Rough approach

- Turn the existing gap list into actionable "shopping items": for each gap,
  compute the concrete acquisition target (species + required attributes) and an
  estimated Pokéyen cost using the existing cost model.
- Where multiple acquisitions could close a gap, recommend the cheapest.
- Present as a checklist on the Project Detail page (and/or aggregated across
  projects later).

## In scope

- Translating current gap analysis into specific, costed acquisition suggestions
  for a single project.

## Out of scope (for now)

- Live market price lookups (no backend / external API).
- Cross-project shopping aggregation (could be a follow-up).
- Auto-adding bought Pokémon to the pool (user still records them).

## Open questions

- How granular should IV suggestions be (exact stats vs. "any 2×31 of these")?
- Should suggestions account for breedable intermediates the user could make
  cheaply, or only direct purchases/catches?
- Where does this live: inline in the plan, or a dedicated "Shopping" tab?

## Complexity / risk

Moderate. Reuses existing gap + cost machinery, but defining "cheapest path to
fill a gap" can get algorithmically involved if it considers breeding chains.
Keep v1 to direct acquisitions.
