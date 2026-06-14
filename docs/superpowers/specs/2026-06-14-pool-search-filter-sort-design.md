# Pool Search / Filter / Sort — Design (Draft)

**Date:** 2026-06-14
**Status:** Draft — idea captured during brainstorm; needs full design before planning
**Tier:** 1 (high value, self-contained, low risk)

## Goal

Let users search, filter, and sort the Owned Pokémon pool so it stays usable as
it grows from a handful to dozens or hundreds of entries.

## Context (what we know)

- The Owned pool lives in `src/features/owned/` (`OwnedPage`, `OwnedPokemonList`)
  and is backed by `src/store/ownedSlice.ts` (`OwnedPokemon` records: IVs, nature,
  ability, gender, egg moves, shiny/alpha, notes).
- Today the view is a plain list with no query controls.
- Mantine provides `TextInput`, `Select`, `MultiSelect`, and table/sort primitives,
  so the UI controls are available without new dependencies.

## Rough approach

- Add a filter/sort bar above `OwnedPokemonList`.
- **Search:** free-text over species name (and notes?).
- **Filter:** by species, nature, ability, gender, shiny/alpha, egg group, and
  IV thresholds (e.g. "HP ≥ 25"). Tags depend on whether tagging exists yet.
- **Sort:** by species, total IVs, individual stat, date added.
- Keep filter/sort state in component state (likely not persisted) — confirm.

## In scope

- Client-side filtering/sorting of the existing in-memory pool. No store schema
  changes required for the core feature.

## Out of scope (for now)

- Tagging (separate feature; filter can adopt tags later).
- Saved/named filter presets.
- Server-side anything (app is pure-frontend).

## Open questions

- Should filter/sort state persist across reloads, or reset each visit?
- Is IV-range filtering needed in v1, or just exact-field filters?
- Does search cover notes, or only species name?

## Complexity / risk

Low. Isolated to the Owned view; no engine or store-migration risk.
