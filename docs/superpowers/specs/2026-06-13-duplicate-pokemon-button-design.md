# Duplicate Pokemon Button — Design

**Date:** 2026-06-13
**Status:** Approved

## Goal

On the owned-pokemon list page, add a "Duplicate" button to each pokemon card.
Clicking it opens the new-pokemon modal prefilled with the values of the pokemon
being duplicated. Saving creates a brand-new, independent pokemon.

## Context

- **List page:** `src/features/owned/OwnedPokemonList.tsx` — renders each pokemon
  as a Card with Edit (✏️) and Delete (🗑️) `ActionIcon` buttons.
- **Modal:** `src/features/owned/OwnedPokemonForm.tsx` — takes an `editingId`
  prop. Undefined → blank "add" form (calls `addOwnedPokemon`); set → prefills
  from the existing pokemon and *updates* it on save (`updateOwnedPokemon`).
- **Page:** `src/features/owned/OwnedPage.tsx` — owns `editingId` state and the
  modal open/close handlers.
- **Type:** `OwnedPokemon` (`src/store/types.ts`): `id`, `speciesId`, `ivs`,
  `nature`, `ability`, `isHiddenAbility`, `gender`, `isShiny`, `isAlpha`,
  `eggMoves`, `notes?`, `createdAt`.
- **Store:** Zustand owned slice (`src/store/ownedSlice.ts`). `addOwnedPokemon`
  assigns a fresh `id = crypto.randomUUID()` and `createdAt = now`.

"Duplicate" is a third form mode: prefill from a source pokemon (like edit) but
create a new pokemon on save (like add).

## Approach

Chosen: **`duplicateFromId` prop** — `OwnedPage` tracks a second piece of state,
`duplicateFromId`, parallel to `editingId`. The form prefills from whichever id
is set; submit branches on `editingId` only, so a set `duplicateFromId` with an
unset `editingId` naturally creates a new pokemon. Minimal change, mirrors the
existing `editingId` pattern, no store changes.

Rejected alternatives:
- **Generic `initialValues` prop** — more flexible but a larger refactor of a
  working form than this feature warrants.
- **Instant clone then open in edit mode** — creates the pokemon before the user
  confirms, leaving an orphan on cancel; contradicts the "open modal prefilled"
  intent.

## Changes

### 1. List — Duplicate button (`OwnedPokemonList.tsx`)

Add a third `ActionIcon` per card, between Edit and Delete, with a duplicate/copy
icon (e.g. ⧉) and an `aria-label`/tooltip "Duplicate". Calls a new `onDuplicate(id)`
callback prop.

### 2. Page — wire the new mode (`OwnedPage.tsx`)

- Add `duplicateFromId` state alongside `editingId`.
- `handleDuplicate(id)` sets `duplicateFromId`, clears `editingId`, opens the modal.
- On modal close, clear both `editingId` and `duplicateFromId`.
- Pass `onDuplicate={handleDuplicate}` to the list and `duplicateFromId` to the form.

### 3. Form — prefill without editing (`OwnedPokemonForm.tsx`)

- Accept a new optional `duplicateFromId` prop.
- Prefill effect sources from `editingId ?? duplicateFromId`, copying **all**
  editable fields **including `notes`**.
- `handleSubmit` branches on `editingId` only: present → `updateOwnedPokemon`;
  absent → `addOwnedPokemon` (fresh `id` + `createdAt`).
- Modal title reflects mode: "Add" / "Edit" / "Duplicate".

### Edge handling

If `duplicateFromId` points to a since-deleted pokemon, the form falls back to a
blank add form (same as a missing `editingId`).

## Testing

- **e2e (Playwright):** duplicate a pokemon → modal opens prefilled with the
  source's values (including notes) → save → a second, independent pokemon
  exists; editing/deleting the duplicate does not affect the original.
- **Unit:** only if non-trivial pure logic is extracted (none expected).
