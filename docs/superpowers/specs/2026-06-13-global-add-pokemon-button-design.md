# Global "Add Pokémon" Button — Design

**Date:** 2026-06-13
**Status:** Approved design, pending implementation plan

## Problem

A user can only add an owned/captured Pokémon from the Owned page (`OwnedPage`).
When working inside a breeding project (project list or project detail page), capturing
a new Pokémon in-game means leaving the project, navigating to Owned, adding it, then
navigating back. The add action should be **globally available** so a freshly captured
Pokémon can be logged in one click from anywhere, returning the user to where they were.

## Goal

Add an "Add Pokémon" button to the top-right of the persistent app header so the add
flow is reachable on every route, and on completion (or cancel) return the user to the
page they came from — most often a project detail page, where the new Pokémon is then
immediately available.

## Approach

Reuse the **existing** `OwnedPage` modal flow via routing + query parameters (no new
modal component, no global modal state). The header button navigates to the Owned route
with parameters that (a) auto-open the existing add form and (b) record where to return.

### Flow

1. A button sits in the top-right of the header in `AppLayout.tsx`, present on every route.
2. Clicking it navigates to:
   `/owned?add=1&returnTo=<encoded current path+search>`
   where `returnTo` is the URL-encoded location the user was on (usually `/projects/:id`).
3. `OwnedPage` detects `add=1` and auto-opens its existing `OwnedPokemonForm` modal as a
   **blank, new** Pokémon form (always blank — not context-aware / not prefilled).
4. On **submit**: `addOwnedPokemon()` runs (existing store action), a success toast shows,
   the modal closes, and the user is navigated back to `returnTo` with `replace: true`
   (so the `?add=1` entry does not linger in browser history).
5. On **cancel**: the modal closes and the user is navigated back to `returnTo` (symmetric
   with submit; no toast). The detour always returns you to where you started.
6. Returning to a project detail page, the Zustand store is reactive, so the newly added
   Pokémon is immediately available there (e.g. as a selectable breeding parent).

### Behavior when no `returnTo` is present

The existing Owned-page "Add Pokémon" button is unchanged: it opens the form with no
`returnTo`, so closing it simply closes the modal and stays on `/owned` (current behavior
preserved). If `add=1` is present without `returnTo` (e.g. a manual URL), closing clears
the `add` query param and stays on `/owned`.

## Components touched

### 1. `src/components/AppLayout.tsx`
- Add a right-aligned "Add Pokémon" button to the header `Group` (e.g. change the header
  `Group` to `justify="space-between"`, with burger+title on the left and the button on
  the right). Use a plus icon if an icon library is already in use; otherwise a labeled
  `Button`.
- Use `useLocation()` to read the current `pathname + search` and `useNavigate()` to push
  `/owned?add=1&returnTo=<encodeURIComponent(currentPathAndSearch)>`.

### 2. `src/features/owned/OwnedPage.tsx`
- Read `useSearchParams()`. In an effect, when `add=1` is present, open the form
  (`setFormOpened(true)`, `editingId = undefined`) once; capture `returnTo` for use on close.
- Update the close handler to receive whether the form was submitted (see form change
  below) and to:
  - show a success toast when `didSubmit` is true **and** this was an add (`editingId`
    was undefined) — edits do not toast,
  - if `returnTo` is present, `navigate(returnTo, { replace: true })`,
  - else clear the `add` param (`setSearchParams({}, { replace: true })`) and stay.

### 3. `src/features/owned/OwnedPokemonForm.tsx`
- Change the `onClose` prop signature from `() => void` to `(didSubmit?: boolean) => void`.
  - Submit success path → call `onClose(true)`.
  - Cancel button → call `onClose(false)`.
- `OwnedPage` is the only consumer, so this is a contained change.

### 4. Notifications (toast) setup
- `@mantine/notifications` is **not** currently a dependency and `<Notifications />` is not
  mounted. Add the dependency, import its CSS, and mount `<Notifications />` inside the
  existing `MantineProvider` in `src/main.tsx`.
- Show the toast via `notifications.show(...)` on a successful add (e.g. "Pokémon added").
  This applies to both the global flow and the existing Owned-page add button (consistent);
  edits remain silent.

## Non-goals (YAGNI)

- No new global modal state / Zustand UI slice — the existing local modal + routing covers it.
- No context-aware prefill from the project goal — the global add is always a blank form.
- No second "quick/minimal" form — the full `OwnedPokemonForm` is reused as-is.
- No changes to the Owned-page add button's existing behavior.

## Error handling / edge cases

- `returnTo` is always derived from an in-app location, so it is a same-origin relative path.
- If `returnTo` points to a now-deleted project, the project detail route already handles a
  missing project; no special handling added here.
- Auto-open effect guards against reopening loops (open once per `add=1` presence).

## Testing

Per project delegation protocol (e2e for behavioral/observable changes, unit for pure logic):

- **e2e (Playwright):** From a project detail page, click the header "Add Pokémon" button →
  the add form opens → fill and submit → assert navigation back to the project detail page
  and a success notification appears, and the new Pokémon is present. Repeat for cancel →
  assert navigation back with no Pokémon added. Verify the button is present on multiple
  routes (projects list, project detail).
- **e2e (regression):** The existing Owned-page add flow still works and stays on `/owned`.
- Add/update unit tests only if any non-trivial pure helper is introduced (e.g. a
  `returnTo` builder/parser); the core change is behavioral and covered by e2e.
