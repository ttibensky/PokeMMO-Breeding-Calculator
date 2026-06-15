# Pool Reservation View — Design

**Date:** 2026-06-15
**Status:** Ready for planning
**Tier:** 2 (derived cross-project state; builds on the full-plan engine)

## Goal

Show the user which owned Pokémon are **reserved** — still needed by an
in-progress project's breeding plan — so they don't accidentally sell or release
a mon a plan depends on, and can see at a glance which mons are free to breed
with. Surface this inline on the owned-Pokémon list: a badge per mon, a
reserved/free filter, and a warning when manually deleting a reserved mon.

## Background

The full-plan engine (`src/engine/fullPlan.ts`, merged) exposes:

```ts
buildFullPlan(pool, goal, getSpecies): FullPlan
// FullPlan.reservedOwnedIds: string[]  — current owned mons this plan consumes
```

`reservedOwnedIds` is exactly the set of owned mons a project's forward plan still
needs (base mons + ready-made intermediates). Reservation is **derived** from this
— no new persisted state.

Today nothing in the app calls `buildFullPlan` and there is no reservation
indicator anywhere in the UI. Each owned mon renders as a card with feature badges
in `src/features/owned/OwnedPokemonList.tsx` (badge row ~lines 183–192); the list
already has a filter system in `src/features/owned/ownedFilters.ts`.

### Relationship to breeding consumption (not part of this feature)

When a breed is reported, the app already **permanently removes both parents** from
the owned pool and adds the child (`ProjectDetailPage.tsx` `handleSubmit`). That is
existing, intended behavior and is unchanged here. As parents leave the pool, they
drop out of every reservation set automatically (the derived map recomputes). This
feature's delete warning targets **manual** removal only (the delete button in the
owned list), never the breed-report flow.

## Decisions (settled)

- **Surface:** inline only — badge + reservation filter + manual-delete warning. No
  new route/nav item.
- **Which projects reserve:** **`in-progress` only.** `planning`, `done`, and
  `abandoned` reserve nothing (a done project's only "reserved" mon is its own goal
  result — noise; abandoned/planning hold nothing).
- **Conflict:** a mon reserved by **2+** in-progress projects is a conflict (it can
  only be consumed once).
- **Delete:** **warn, don't block.** The user stays in control.
- **State:** derived; no new persisted fields.

## Architecture

### Data layer — pure function + thin hook

New `src/features/owned/reservations.ts`:

```ts
export interface ProjectRef { projectId: string; projectName: string; }

// ownedId -> the in-progress projects whose plan reserves it
export function computeReservations(
  pool: OwnedPokemon[],
  projects: BreedingProject[],
  getSpecies: (id: number) => PokemonSpecies | undefined,
): Record<string, ProjectRef[]> {
  const map: Record<string, ProjectRef[]> = {};
  for (const p of projects) {
    if (p.status !== 'in-progress') continue;
    const { reservedOwnedIds } = buildFullPlan(pool, p.goal, getSpecies);
    for (const id of reservedOwnedIds) {
      (map[id] ??= []).push({ projectId: p.id, projectName: p.name });
    }
  }
  return map;
}

export function useReservations(): Record<string, ProjectRef[]> {
  const pool = useBreedingStore((s) => s.ownedPokemon);
  const projects = useBreedingStore((s) => s.projects);
  return useMemo(
    () => computeReservations(pool, projects, getSpeciesById),
    [pool, projects],
  );
}
```

- `computeReservations` is pure (takes `getSpecies` as a param) → unit-testable.
- `getSpeciesById` (`src/data/index.ts`) is a stable module-level import.
- `useMemo` recomputes only when `pool` or `projects` identity changes (Zustand
  immutable updates), so the per-project `buildFullPlan` calls run only on real
  mutations. Cost is bounded (each plan ≤ ~127 nodes; few in-progress projects).

### Badge on owned cards

In `OwnedPokemonList.tsx`, read `useReservations()` once; for each `mon`, look up
`reservations[mon.id]`:

- **undefined / empty** → no badge (unchanged card).
- **length === 1** → neutral `Reserved` badge; tooltip shows the project name.
- **length >= 2** → conflict badge `Reserved ·{N}` in a warning color (red) with a
  `⚠` marker; tooltip lists all project names.

The badge sits in the existing badge row (~lines 183–192) alongside
Shiny/Alpha/IV-count/hidden-ability badges, following their Mantine `Badge` style.

### Reservation filter

Extend the owned filter system with a `reservation` dimension:

```ts
// ownedFilters.ts — add to OwnedFilters
reservation: 'all' | 'reserved' | 'free'; // default 'all'
```

Because reservation is derived from projects (not a field on `OwnedPokemon`), the
filter step takes the reserved-id set alongside the existing criteria:

- `all` → no reservation filtering.
- `reserved` → keep mons whose id is in the reserved set (≥1 in-progress plan).
- `free` → keep mons whose id is **not** in the reserved set ("free to breed").

UI: a segmented control / select labeled `All / Reserved / Free` in the existing
owned-list filter bar. The component derives `reservedIds = new Set(Object.keys(reservations))`
and passes it to the filter step.

### Manual-delete warning

When the user triggers delete on an owned card and `reservations[mon.id]` is
non-empty, open a confirmation modal:

> "{name} is reserved by {N} in-progress project(s): {names}. Delete anyway?"

Confirm → `removeOwnedPokemon(mon.id)`. Cancel → no-op. Deleting a **free** mon
keeps its current behavior (no new modal). This guards manual removal only; the
breed-report flow is untouched.

## Components & files

- **Create** `src/features/owned/reservations.ts` — `computeReservations` (pure) +
  `useReservations` hook + `ProjectRef` type.
- **Create** `src/features/owned/reservations.test.ts` — unit tests.
- **Modify** `src/features/owned/ownedFilters.ts` — add the `reservation` dimension
  and a reserved-id-aware filter step (default `all`, backward-compatible).
- **Modify** `src/features/owned/OwnedPokemonList.tsx` — reservation badges + the
  manual-delete confirmation.
- **Modify** the owned filter-bar UI (the component rendering the existing
  nature/ability/gender controls) — add the `All / Reserved / Free` control.
- **Create** an e2e spec under `e2e/` (or extend the most relevant existing owned
  spec).

## Testing

- **Unit (Vitest)** for `computeReservations`:
  - No projects → empty map.
  - One in-progress project reserves exactly its plan's `reservedOwnedIds`.
  - A mon reserved by two in-progress projects → conflict (length 2, both names).
  - `planning` / `done` / `abandoned` projects contribute nothing.
  - A free mon never appears in the map.
- **e2e (Playwright)** for the UI (hash route `/#/owned`; scoped selectors per
  `.claude/rules/testing-conventions.md` — no unscoped `[role="option"]`):
  - Reserved badge appears on a mon needed by an in-progress project; conflict badge
    when two in-progress projects need the same mon.
  - The `Reserved` / `Free` filter narrows the list correctly; `All` shows everything.
  - Deleting a reserved mon shows the confirmation; confirming removes it; a free mon
    deletes without the new modal.
  - Seed store state via `addInitScript` before navigation (store hydrates on first
    mount).

## Out of scope

- A dedicated "Reservations" route/screen.
- A manual reserve/lock toggle independent of plans.
- Automatic conflict resolution (re-planning to avoid double-use).
- Any new persisted state — reservations stay fully derived.
- Breeding Tree Visualization — a separate later feature on the same engine.

## Complexity / risk

Low–moderate. The hard part (the plan + `reservedOwnedIds`) already exists and is
tested. Remaining work is a small pure derivation plus three inline UI touches
(badge, filter, delete confirm). Main watch-item is recompute cost, bounded by the
number of in-progress projects and memoized on pool/projects identity.
