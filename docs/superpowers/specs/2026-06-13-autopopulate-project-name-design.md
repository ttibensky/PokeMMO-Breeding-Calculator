# Auto-populate project name from species

**Date:** 2026-06-13
**Status:** Approved (design)

## Goal

In the project modal (`GoalForm`), the target species should be chosen first, and
selecting it should pre-fill the **Project name** field with the species' display
name. The pre-filled name remains fully editable; it is only a convenience default.

## Scope

- File: `src/features/projects/GoalForm.tsx` (and any co-located test).
- No data-layer or `SpeciesSelect` changes. Species display names are already
  available via `allSpecies` / `getSpeciesById` in `src/data/index.ts`.

## Field order

Move the **Target species** selector above the **Project name** input so species is
chosen first. The remaining fields (Target IVs, Nature, Ability, Target gender) keep
their current order.

Resulting order:

1. Target species
2. Project name
3. Target IVs
4. Nature
5. Ability
6. Target gender (conditional)

## Pre-fill logic

- Add a session-scoped flag `nameManuallyEdited` (default `false`), tracked in
  component state.
- In the species `onChange` handler (`handleSpeciesChange`): if
  `nameManuallyEdited === false`, set the name field to the newly selected species'
  display name. If `true`, leave the name untouched.
- In the name input's `onChange`: set `nameManuallyEdited = true` (in addition to the
  existing Mantine form binding), so a user-typed name is never overwritten afterward.

The flag tracks only **in-session manual edits**. Regeneration fires exclusively
inside the species `onChange` handler — never on mount — so opening either modal does
not alter the name on its own.

## Behavior across modes

- **Create modal:** name starts empty (`nameManuallyEdited = false`). The first
  species selection fills the name; changing species again regenerates it — until the
  user edits the name, after which it is preserved.
- **Edit modal:** name initializes to the existing saved name
  (`nameManuallyEdited = false`). Opening the modal does not alter the name. If the
  user changes the species before touching the name, the name regenerates to the new
  species name; once the user edits the name field, it is preserved.

### Accepted consequence

In the edit modal, if a user changes the species *before* touching the name field,
their previously-saved custom name is replaced by the new species name. This is the
intended behavior ("same applies in the edit modal") and is recoverable by retyping.

## Testing

User-facing behavior → Playwright e2e. Add or extend the most relevant spec to cover:

1. Selecting a species pre-fills the project name with the species name.
2. Re-selecting a different species regenerates the pre-filled name.
3. After manually editing the name, changing species leaves the name unchanged.
4. Field order: species selector appears before the name input.
