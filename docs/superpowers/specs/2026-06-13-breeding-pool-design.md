# Breeding Pool — Design Spec

**Date:** 2026-06-13
**Status:** Approved (design); pending implementation plan
**Topic:** Egg-group-based "who can I breed into this project" view

## Problem

A breeding project has a target species and target attributes (perfect IVs + optional
nature). The breeding engine already understands egg-group compatibility — `validation.ts`
rejects incompatible pairs and `planner.ts` `isCompatible()` filters owned Pokémon when
building a recommendation. But the user has no way to **discover** what they could breed
into a project beyond the Pokémon they already own, and no consolidated view of which
owned Pokémon are compatible carriers for each target attribute.

This feature adds a **Breeding Pool** view: gap-driven first (what am I missing and how do
I source it), expandable to the full compatible-species reference.

## Core mechanic (constraints that shape the design)

In PokeMMO the **offspring takes the mother's species**. Consequences:

1. To keep producing the target species, the **female slot is always the target species**
   (or a Ditto pairing). Contributors of a *different* species are brought in as **males
   (or Ditto)**.
2. A different-species **female** carrier is therefore **not a usable contributor** to the
   target line — pairing her as the mother yields *her* species, not the target. She is
   excluded from coverage (may be shown flagged with the reason).
3. **Same-species (target) carriers** count regardless of gender — they *are* the line.
4. **Genderless non-Ditto species are excluded** from the discovery pool: they breed only
   with Ditto and only produce their own species, so they can't feed the target line.
   **Ditto** is always available as a universal option.
5. Species in the **`no-eggs`** group are excluded entirely (cannot breed).
6. Egg-group compatibility is the *only* species-level filter. Whether a species "has" a
   needed IV is an individual-Pokémon property, not a species one — any species can roll
   any IVs. So the compatible-species pool is the same regardless of *which* attribute the
   gap is for; the gap framing explains *why* you need to acquire, the pool tells you the
   *eligible species* to acquire from.

## Architecture

One read-only feature. **No new store state, no persistence.** Pure engine logic consumed
by one UI section that reads existing store + data.

### Engine (new: `src/engine/compatiblePool.ts`, unit-tested)

Reuse the egg-group compatibility predicate the planner already uses. Extract/share
`isCompatible` (or the underlying egg-group check) so the planner and this feature never
diverge.

- `getCompatibleSpecies(targetSpeciesId, getSpeciesById, allSpecies) => PokemonSpecies[]`
  - Species sharing ≥1 egg group with the target,
  - **minus** `no-eggs` species and genderless-non-Ditto species,
  - **plus** Ditto (universal).
  - Returned in a stable order (by id or name) for grouping by egg group in the UI.

- `computeCoverage(goal, ownedPokemon, getSpeciesById) => AttributeCoverage[]`
  - One entry per target attribute: each perfect IV stat in `goal.targetIVs`, plus the
    nature if `goal.nature` is set.
  - For each attribute: the list of **usable owned carriers** and an `isGap: boolean`
    (true when the list is empty).
  - A **usable carrier** is an owned Pokémon that:
    1. is egg-group-compatible with the target (same predicate as above),
    2. carries the attribute — IV `=== 31` for that stat, or nature matches, and
    3. can feed the line — same species (any gender) **OR** Ditto **OR**
       different-species **male**.

### UI (new: `src/features/projects/BreedingPoolSection.tsx`)

A **collapsible section** on `ProjectDetailPage`, rendered below the recommendation/plan
area. Two parts:

1. **Coverage & gaps** — one row per target attribute.
   - Covered → ✓ with carrier chips (the owned mons that carry it).
   - Uncovered → ⚠ gap with a call-to-action: "acquire a male/Ditto carrier — see
     compatible species below."

2. **Compatible species (expandable, collapsed by default)** — searchable list grouped by
   egg group: sprite + name + egg-group tags. Ditto pinned/highlighted as the universal
   option. A short note: contributors should be **male or Ditto**; your female slot stays
   the target species.

### Data flow

The section reads `project.goal` and `ownedPokemon` from the Zustand store and
`getSpeciesById` (and the full species list) from `src/data`. It runs the two pure
functions inside `useMemo`. Nothing is written back to the store.

## Edge cases

- **Target in `no-eggs` or genderless** (e.g. a legendary): empty or Ditto-only pool, shown
  with an explanatory message ("breedable only with Ditto" / "cannot be bred").
- **No owned Pokémon**: every target attribute renders as a gap.
- **Goal with no nature set**: coverage covers IV attributes only.
- **Empty compatible pool but owned target-species mons exist**: coverage can still show
  same-species carriers even when the discovery pool is Ditto-only.

## Testing

- **Vitest units** (co-located `compatiblePool.test.ts`) for both engine functions:
  - compatibility filtering (shares egg group; `no-eggs` and genderless-non-Ditto excluded;
    Ditto included),
  - the gender constraint (different-species female excluded; different-species male and
    same-species any-gender included),
  - coverage / gap logic (IV `=== 31`, nature match, empty → gap),
  - edge species (target genderless / `no-eggs`).
- **Playwright e2e** (extend the most relevant existing project spec): open a project, see
  coverage rows including a gap, expand the compatible-species panel and see the pool.

## Out of scope

- Acquisition flow / GTL integration (no such data); discovery is informational — the user
  goes and adds the acquired Pokémon to Owned manually.
- Evolution-line handling beyond what egg-group matching already provides.
- Any change to the recommendation/planner algorithm itself.
