# Pool Search / Filter / Sort — Design

**Date:** 2026-06-14
**Status:** Approved, ready for implementation
**Tier:** 1 (high value, self-contained, low risk)

## Goal

Let users search, filter, and sort the Owned Pokémon pool so it stays usable as
it grows. Search already exists (species-name `TextInput` in `OwnedPokemonList`);
this feature **adds filters and sorting** on top of it and extracts the combined
logic into a pure, unit-testable helper.

## Context (what we know)

- `OwnedPokemon` (`src/store/types.ts:24`): `id, speciesId, ivs, nature, ability,
  isHiddenAbility, gender, isShiny, isAlpha, eggMoves, notes?, createdAt`.
- `IVs` = `Record<StatKey, number>` (`hp/atk/def/spa/spd/spe`). `Gender` =
  `'male' | 'female' | 'genderless'`.
- Species lookup: `getSpeciesById(speciesId)` (`src/data/index.ts:20`) →
  `PokemonSpecies` with `name` and `eggGroups: string[]`.
- Helpers in `src/features/owned/ownedHelpers.ts`: `countPerfectIVs`, `formatIVs`,
  `allowedGenders`, `normalAbilities`, `hiddenAbility`. **No total-IV helper** —
  add one.
- Canonical natures: `src/data/natures.ts` (`NATURES`).
- `OwnedPokemonList.tsx`: empty state at lines 57–68 (keep), existing search
  `TextInput` ~88–94, "no results" message ~97–99, card `.map()` ~100–167.
- e2e: `e2e/owned.spec.ts`, route `/#/owned`, role-based selectors.

## Decisions (open questions resolved)

- **State is component-local**, not persisted; resets when leaving the view.
- **Search** stays species-name only (preserve current behavior), moved into the
  shared helper so there is one source of truth.
- **Filters (single-select, "All" = no filter):** Nature, Ability, Gender, Egg
  group — each a clearable `Select`. **Shiny only** and **Alpha only** as
  `Checkbox`es.
- **Sort:** a `Select` over `Date added` (default), `Species name`, `Total IVs`,
  `Perfect IVs`, plus an asc/desc `ActionIcon`. Default = `createdAt` ascending,
  preserving today's insertion order.
- **Filter option lists are derived from the current pool** (only natures /
  abilities / genders / egg groups actually present), so dropdowns never offer
  empty choices.
- **No new dependencies** — Mantine `Select`/`Checkbox`/`Group`/`ActionIcon`.

## Architecture

New pure module **`src/features/owned/ownedFilters.ts`** (no React), fully unit
tested:

```ts
export type OwnedSortKey = 'createdAt' | 'name' | 'totalIVs' | 'perfectIVs';
export type SortDir = 'asc' | 'desc';

export interface OwnedFilterCriteria {
  search: string;
  nature: string | null;
  ability: string | null;
  gender: Gender | null;
  eggGroup: string | null;
  shinyOnly: boolean;
  alphaOnly: boolean;
  sortKey: OwnedSortKey;
  sortDir: SortDir;
}

export const DEFAULT_CRITERIA: OwnedFilterCriteria; // empty search, all null, false, createdAt/asc

export function totalIVs(ivs: IVs): number; // sum of 6 stats

export function deriveFilterOptions(list: OwnedPokemon[]): {
  natures: string[]; abilities: string[]; genders: Gender[]; eggGroups: string[];
}; // sorted, de-duped, from species lookup where needed

export function filterAndSortOwned(
  list: OwnedPokemon[],
  c: OwnedFilterCriteria,
): OwnedPokemon[];
```

Matching semantics: `search` = case-insensitive substring of the species name;
each non-null filter is exact-match (`eggGroup` matches if the species'
`eggGroups` includes it); `shinyOnly`/`alphaOnly` keep only flagged Pokémon when
true. Sorting is stable; `name` sorts by resolved species name, IV keys by the
respective counts, `createdAt` lexicographically (ISO strings).

`totalIVs` lives in `ownedFilters.ts` and is reused wherever needed.

## UI

`OwnedPokemonList` holds `criteria` in `useState` (seeded from
`DEFAULT_CRITERIA`). A filter/sort bar (a wrapping `Group`, `data-testid=
"owned-filter-bar"`) sits between the search input and the card list. The rendered
list is `filterAndSortOwned(ownedPokemon, criteria)`. Each control carries an
`aria-label`. The filter Selects use **distinct, descriptive** names so they never
collide with the Add/Edit-Pokémon form's own `Nature`/`Ability`/`Gender` fields
when that modal is open over the list: `Filter by nature`, `Filter by ability`,
`Filter by gender`, `Filter by egg group`, plus `Sort by`, `Sort direction`,
`Shiny only`, `Alpha only`. This is for accessible, scoped e2e selection.
Reuse the existing zero-result message (generalize copy to "No Pokémon match your
filters.").

## Testing

- **Unit (Vitest)** on `ownedFilters.ts`: `totalIVs`; each filter in isolation and
  combined; search case-insensitivity/substring; egg-group membership; shiny/alpha
  toggles; every sort key in both directions (stable); `deriveFilterOptions`
  de-dupes and sorts and only includes present values; empty-pool edge case.
- **e2e (Playwright)** in `e2e/owned.spec.ts` (route `/#/owned`): seed a few
  Pokémon, apply a filter and assert the visible set narrows; clear it and assert
  it restores; change sort and assert order; assert the "no matches" message for
  an empty result. Use `getByLabel`/scoped selectors per testing-conventions.

## Out of scope (YAGNI)

- Persisting filter/sort state across reloads or navigation.
- Tagging, IV-range sliders, saved filter presets, multi-select filters.
- Searching notes or egg moves.

## Risk

Low. Additive to one view; pure logic is isolated and unit-tested; no store
migration, no engine changes.
