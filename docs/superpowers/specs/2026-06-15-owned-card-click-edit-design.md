# Owned card click → open edit modal

**Date:** 2026-06-15
**Status:** Approved

## Goal

On the Owned page, clicking anywhere on an owned pokemon card opens the edit
modal — the same modal the ✏️ edit button already opens. The ✏️ button stays.

## Background

- Owned page: `src/features/owned/OwnedPage.tsx` — renders the list and the edit
  modal (`OwnedPokemonForm`), and owns the local state `formOpened`, `editingId`,
  `duplicateFromId`. `handleEdit(id)` sets `editingId` + opens the form.
- List: `src/features/owned/OwnedPokemonList.tsx` — renders one `<Card>` per
  pokemon (around line 222, `data-testid="owned-card-<id>"`). The card itself has
  **no** click handler today. Three `ActionIcon` buttons sit on the right:
  - ✏️ edit → `onEdit(mon.id)`
  - ⧉ duplicate → `onDuplicate(mon.id)`
  - 🗑️ delete → `setConfirmId(mon.id)` (opens a delete-confirmation modal)
- The form modal title is "Edit Pokémon" when `editingId` is set.

No new state, store changes, or props are needed — the existing `onEdit`
callback already wires everything.

## Change

Single file: `src/features/owned/OwnedPokemonList.tsx`.

1. **Card click → edit.** Add `onClick={() => onEdit(mon.id)}` to the per-pokemon
   `<Card>`, reusing the existing `onEdit` callback.
2. **Cursor affordance.** Add `style={{ cursor: 'pointer' }}` to the Card so the
   mouse signals it is clickable.
3. **Protect the action buttons.** The ✏️ / ⧉ / 🗑️ buttons live inside the card.
   Their click handlers must call `e.stopPropagation()` so they do not also fire
   the card's edit click. This includes the ✏️ button (kept intentionally, but it
   should not double-handle).

## Decisions

- **Keep the ✏️ edit button** (not removed) — discoverability over minimalism,
  even though the whole card now opens edit.
- **Mouse-click only** — no keyboard / screen-reader accessibility. The card is
  **not** made focusable (`tabIndex`), is **not** given a `role`, and does **not**
  handle Enter/Space. This is an explicit scope decision; revisit if a11y becomes
  a requirement.

## Out of scope

- Keyboard / screen-reader access to the card click.
- Any change to the duplicate or delete behaviors themselves (only their event
  propagation is touched).
- Any change to `OwnedPage`, the Zustand store, or `OwnedPokemonForm`.

## Testing (e2e, Playwright)

Extend the most relevant existing Owned spec rather than adding a new file.
Hash routing: navigate to `/#/owned`. Seed an owned pokemon via the established
`addInitScript` localStorage-seeding pattern.

1. Click the card body — scoped via `data-testid="owned-card-<id>"`, targeting a
   non-button region of the card — and assert the "Edit Pokémon" modal opens.
2. Click the 🗑️ delete button and assert the **delete confirmation** opens while
   the edit modal does **not** — this guards the `stopPropagation` on the action
   buttons.
