# Pool Reservation View — Design (Draft)

**Date:** 2026-06-14
**Status:** Draft — idea captured during brainstorm; needs full design before planning
**Tier:** 2 (high value, introduces shared cross-project state)

## Goal

Show which owned Pokémon are "reserved" by which project's plan, so the user
doesn't accidentally use the same Pokémon in two plans or sell something a plan
still needs.

## Context (what we know)

- Owned Pokémon: `src/store/ownedSlice.ts`. Projects + their plans/steps:
  `src/store/projectsSlice.ts`. Plans reference owned Pokémon IDs in their steps.
- Multiple concurrent projects are supported; today nothing surfaces cross-project
  usage of a given Pokémon.

## Rough approach

- Compute, for each owned Pokémon, the set of projects whose current plan/steps
  reference it ("reserved by").
- Surface this in the Owned list (e.g. a badge "used by 2 projects") and/or warn
  on delete if a Pokémon is reserved.
- Reservation is **derived** from existing plan data — avoid adding a separate
  manual reservation field unless needed.

## In scope

- A derived, read-only reservation indicator + delete-time warning.

## Out of scope (for now)

- Manual "reserve/lock" toggles independent of plans.
- Automatic conflict resolution (re-planning to avoid double-use).

## Open questions

- Should a Pokémon used by multiple plans be flagged as a *conflict* (can't be in
  two places) or just informationally "shared"?
- Does "reserved" mean referenced anywhere in the plan, or only in not-yet-done
  steps?
- Block deletion of a reserved Pokémon, or just warn?

## Complexity / risk

Moderate. No new persisted state if derived from plans, but requires a reliable
cross-slice selector and clear semantics for "reserved" vs "conflict".
