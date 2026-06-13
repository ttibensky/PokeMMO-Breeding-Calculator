# Remove the Owned-page "Add Pokémon" Button — Design

**Date:** 2026-06-13
**Status:** Approved design, pending implementation plan

## Problem

The Owned page (`OwnedPage`) has a page-level "Add Pokémon" button in its header, next to
the "Owned Pokémon" title. Since the global "Add Pokémon" button now lives in the app header
(top-right, on every route — see the
[global add button design](2026-06-13-global-add-pokemon-button-design.md)), the page-level
button is redundant.

## Goal

Remove the redundant page-level "Add Pokémon" button from `OwnedPage`, relying on the global
header button for adding from a populated list. Keep the empty-state "Add your first Pokémon"
button as a first-run onboarding call-to-action.

## Change

### `src/features/owned/OwnedPage.tsx`

Current header (lines 53–56):

```tsx
<Group justify="space-between" mb="md">
  <Title order={1}>Owned Pokémon</Title>
  <Button onClick={handleAdd}>Add Pokémon</Button>
</Group>
```

Becomes:

```tsx
<Title order={1} mb="md">Owned Pokémon</Title>
```

- Remove the page-level `<Button>` and the now single-child `<Group>` wrapper.
- Remove the now-unused `Button` and `Group` imports (line 2 becomes `import { Title } from '@mantine/core';`).
- Keep `handleAdd` — it is still passed as `onAdd` to `OwnedPokemonList` (line 58) for the
  empty-state button, so it is not orphaned.

## Unchanged (non-goals)

- The empty-state "Add your first Pokémon" button in `OwnedPokemonList` (`onAdd`-driven).
- The global header "Add Pokémon" button (`AppLayout`, `data-testid="global-add-pokemon"`).
- The `?add=1` / `returnTo` auto-open flow and the success toast in `OwnedPage`.
- The edit and form-close behavior (`handleEdit`, `handleClose`).

After this change, on a populated Owned list the only add affordance on the page is the
global header button; the empty list still shows its own "Add your first Pokémon" CTA.

## Tests

Two e2e helpers currently click an unscoped page-level "Add Pokémon" button (with `.first()`)
that this change removes. They must be updated so the suite stays green:

- `e2e/owned.spec.ts` — `openAddForm(via: 'header')` (around line 9).
- `e2e/projects.spec.ts` — `openAddOwnedForm(via: 'header')` (around line 30).

For each, the "header" path must use the **global** header button instead
(`page.getByTestId('global-add-pokemon')`). Because the global button navigates to
`/owned?add=1&returnTo=<current path>` and, after a successful add, navigates back to
`returnTo` with `replace: true`, any test step that adds via the header and then expects to
remain on the prior page must account for that return navigation (it already lands back where
it started, so assertions on the originating page remain valid). Dialog-scoped submit clicks
and empty-state ("Add your first Pokémon") clicks are unaffected.

The implementation plan will inspect the actual call sites of these helpers (which `via`
value each caller passes, and what each asserts next) and update only what the removal breaks.

## Verification

`npm run typecheck && npm run lint && npm run test:unit && npm run test:e2e` all green, with
no remaining reference to a page-level Owned "Add Pokémon" button.
