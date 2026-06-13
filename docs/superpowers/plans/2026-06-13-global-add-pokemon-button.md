# Global "Add Pokémon" Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a globally-available "Add Pokémon" button to the app header that opens the existing add form from any route and returns the user to where they were after submit/cancel.

**Architecture:** Reuse the existing `OwnedPage` modal via routing. The header button navigates to `/owned?add=1&returnTo=<encoded current path>`; `OwnedPage` auto-opens its existing `OwnedPokemonForm` and, on close, navigates back to `returnTo`. A success toast (`@mantine/notifications`) confirms adds. No new modal component, no global modal state.

**Tech Stack:** React 18, React Router v6 (HashRouter), Zustand (persisted), Mantine UI v7, Vitest (unit), Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-06-13-global-add-pokemon-button-design.md`

---

## File Structure

- **Create:** `e2e/global-add.spec.ts` — e2e coverage for the global add flow.
- **Modify:** `src/main.tsx` — add `@mantine/notifications` CSS + `<Notifications />` provider.
- **Modify:** `package.json` — add `@mantine/notifications` dependency.
- **Modify:** `src/features/owned/OwnedPokemonForm.tsx` — `onClose` gains a `didSubmit` flag.
- **Modify:** `src/features/owned/OwnedPage.tsx` — read query params, auto-open, navigate back, toast.
- **Modify:** `src/components/AppLayout.tsx` — add the global header button.

Tasks are ordered so each builds on a green baseline: notifications infra → form signal → page behavior → header button.

---

## Task 1: Add notifications dependency and provider

**Files:**
- Modify: `package.json` (add dependency)
- Modify: `src/main.tsx:1-17`

This is enabling infrastructure (a dependency + provider mount). There is no isolated behavior to unit-test here; it is verified by typecheck, build, and the existing e2e suite staying green. The toast behavior itself is exercised by the e2e tests in Tasks 3–4.

- [ ] **Step 1: Install the dependency (version matched to existing Mantine)**

Existing Mantine packages are `^7.17.8`. Run:

```bash
npm install @mantine/notifications@^7.17.8
```

Expected: `package.json` gains `"@mantine/notifications": "^7.17.8"` under `dependencies`; `package-lock.json` updated.

- [ ] **Step 2: Mount the provider and import its CSS in `src/main.tsx`**

Replace the entire file contents with:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { theme } from './theme';
import { AppRouter } from './router';
import { ErrorBoundary } from './components/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} forceColorScheme="light" defaultColorScheme="light">
      <Notifications />
      <ErrorBoundary>
        <AppRouter />
      </ErrorBoundary>
    </MantineProvider>
  </React.StrictMode>
);
```

- [ ] **Step 3: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: PASS (no type errors; build succeeds).

- [ ] **Step 4: Regression — existing e2e still green**

Run: `npm run test:e2e -- owned.spec.ts`
Expected: PASS (all existing Owned-page tests pass; the provider mount is inert until used).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/main.tsx
git commit -m "feat: add @mantine/notifications provider"
```

---

## Task 2: Give `OwnedPokemonForm.onClose` a submit/cancel signal

**Files:**
- Modify: `src/features/owned/OwnedPokemonForm.tsx:41-45` (interface), `:181` (submit), `:274` (cancel)

`OwnedPage` is the only consumer of `OwnedPokemonForm`. We widen `onClose` to `(didSubmit?: boolean) => void` so the page can distinguish a successful save from a cancel. This is type-compatible with Mantine `Modal`'s `onClose={() => void}` — an X/Escape close calls it with no argument (`didSubmit === undefined`), which the page treats as a cancel.

- [ ] **Step 1: Update the props interface**

In `src/features/owned/OwnedPokemonForm.tsx`, change the interface (lines 41-45):

```tsx
interface OwnedPokemonFormProps {
  opened: boolean;
  onClose: (didSubmit?: boolean) => void;
  editingId?: string;
}
```

- [ ] **Step 2: Pass `true` on submit success**

In the `handleSubmit` function, change the final call (line 181) from `onClose();` to:

```tsx
    onClose(true);
```

(Context — the surrounding success path, unchanged otherwise:)

```tsx
    if (editingId) {
      updateOwnedPokemon(editingId, payload);
    } else {
      addOwnedPokemon(payload);
    }
    onClose(true);
```

- [ ] **Step 3: Pass `false` on cancel**

Change the Cancel button (line 274) from `onClick={onClose}` to:

```tsx
            <Button variant="default" onClick={() => onClose(false)} type="button">
              Cancel
            </Button>
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: FAIL — `src/features/owned/OwnedPage.tsx` passes `onClose={handleClose}` where `handleClose: () => void`; this is still assignable (a `() => void` is assignable to `(didSubmit?: boolean) => void`), so typecheck should actually PASS. Confirm PASS. If it fails, the error will point at the `handleClose` signature, which Task 3 updates.

- [ ] **Step 5: Regression — existing e2e still green**

Run: `npm run test:e2e -- owned.spec.ts`
Expected: PASS (submit and cancel still close the modal; behavior unchanged for the Owned page).

- [ ] **Step 6: Commit**

```bash
git add src/features/owned/OwnedPokemonForm.tsx
git commit -m "feat: signal submit vs cancel from OwnedPokemonForm.onClose"
```

---

## Task 3: OwnedPage auto-opens from query param, returns, and toasts

**Files:**
- Modify: `src/features/owned/OwnedPage.tsx` (entire file)
- Test: `e2e/global-add.spec.ts` (create)

`OwnedPage` reads `?add=1` to auto-open the form as a blank add, captures `returnTo`, and on close navigates back to `returnTo` (submit and cancel both return). A success toast shows only on a successful **add** (not edits). This task is testable in isolation by navigating directly to the URL — no header button needed yet.

- [ ] **Step 1: Write the failing e2e test**

Create `e2e/global-add.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

// Pick a species from the searchable Species Select (portal-rendered options).
async function selectSpecies(page: import('@playwright/test').Page, name: string) {
  const speciesInput = page.getByRole('textbox', { name: 'Species' });
  await speciesInput.click();
  await speciesInput.fill(name);
  const option = page.locator('[role="option"]', { hasText: name }).first();
  await option.waitFor({ state: 'visible' });
  await option.click();
}

test.describe('Global Add Pokémon — OwnedPage query param', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    await page.evaluate(() => localStorage.clear());
  });

  test('auto-opens the add form from ?add=1 and returns to returnTo on submit', async ({ page }) => {
    await page.goto('./#/owned?add=1&returnTo=%2Fprojects');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await selectSpecies(page, 'Bulbasaur');
    await dialog.getByRole('button', { name: 'Add Pokémon' }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page).toHaveURL(/#\/projects$/);
    await expect(page.getByText('Pokémon added')).toBeVisible();
  });

  test('returns to returnTo on cancel without adding or toasting', async ({ page }) => {
    await page.goto('./#/owned?add=1&returnTo=%2Fprojects');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page).toHaveURL(/#\/projects$/);
    await expect(page.getByText('Pokémon added')).not.toBeVisible();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:e2e -- global-add.spec.ts`
Expected: FAIL — navigating to `#/owned?add=1` does not open the dialog yet (no auto-open), so `expect(dialog).toBeVisible()` times out.

- [ ] **Step 3: Implement the OwnedPage changes**

Replace the entire contents of `src/features/owned/OwnedPage.tsx` with:

```tsx
import { useState, useEffect, useRef } from 'react';
import { Title, Button, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { OwnedPokemonList } from './OwnedPokemonList';
import { OwnedPokemonForm } from './OwnedPokemonForm';

export function OwnedPage() {
  const [formOpened, setFormOpened] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const returnToRef = useRef<string | null>(null);

  useEffect(() => {
    if (searchParams.get('add') === '1') {
      returnToRef.current = searchParams.get('returnTo');
      setEditingId(undefined);
      setFormOpened(true);
    }
  }, [searchParams]);

  function handleAdd() {
    setEditingId(undefined);
    setFormOpened(true);
  }

  function handleEdit(id: string) {
    setEditingId(id);
    setFormOpened(true);
  }

  function handleClose(didSubmit?: boolean) {
    const wasAdd = editingId === undefined;
    setFormOpened(false);
    setEditingId(undefined);

    if (didSubmit && wasAdd) {
      notifications.show({ message: 'Pokémon added', color: 'green' });
    }

    const returnTo = returnToRef.current;
    returnToRef.current = null;
    if (returnTo) {
      navigate(returnTo, { replace: true });
    } else if (searchParams.get('add')) {
      setSearchParams({}, { replace: true });
    }
  }

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={1}>Owned Pokémon</Title>
        <Button onClick={handleAdd}>Add Pokémon</Button>
      </Group>

      <OwnedPokemonList onAdd={handleAdd} onEdit={handleEdit} />

      <OwnedPokemonForm
        opened={formOpened}
        onClose={handleClose}
        editingId={editingId}
      />
    </>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:e2e -- global-add.spec.ts`
Expected: PASS — both the submit-returns and cancel-returns tests pass.

- [ ] **Step 5: Typecheck + regression**

Run: `npm run typecheck && npm run lint && npm run test:e2e -- owned.spec.ts`
Expected: PASS (no type/lint errors; existing Owned-page behavior preserved — note the Owned-page add now also shows the toast, which does not affect those assertions).

- [ ] **Step 6: Commit**

```bash
git add src/features/owned/OwnedPage.tsx e2e/global-add.spec.ts
git commit -m "feat: OwnedPage auto-opens add form from query param and returns to caller"
```

---

## Task 4: Global "Add Pokémon" button in the app header

**Files:**
- Modify: `src/components/AppLayout.tsx` (entire file)
- Test: `e2e/global-add.spec.ts` (append tests)

The header button is available on every route. It navigates to `/owned?add=1&returnTo=<encoded current path>`. It carries `data-testid="global-add-pokemon"` so tests select it unambiguously (the visible label "Add Pokémon" collides with the Owned-page button and the dialog submit button).

- [ ] **Step 1: Append the failing e2e tests**

Add these two tests inside `e2e/global-add.spec.ts` (a new `describe` block at the end of the file):

```typescript
test.describe('Global Add Pokémon — header button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    await page.evaluate(() => localStorage.clear());
  });

  test('header button is visible on the projects page and opens the add form', async ({ page }) => {
    await page.goto('./#/projects');

    const addBtn = page.getByTestId('global-add-pokemon');
    await expect(addBtn).toBeVisible();

    await addBtn.click();
    await expect(page).toHaveURL(/#\/owned\?add=1/);
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('adds a captured Pokémon from a project detail page and returns there', async ({ page }) => {
    // Create a project from the empty state.
    await page.goto('./#/projects');
    await page.getByRole('button', { name: 'Create your first project' }).click();
    const goalDialog = page.getByRole('dialog');
    await expect(goalDialog).toBeVisible();
    await page.getByLabel('Project name').fill('Test Project');
    const goalSpecies = page.getByRole('textbox', { name: 'Species' });
    await goalSpecies.click();
    await goalSpecies.fill('Bulbasaur');
    const goalOption = page.locator('[role="option"]', { hasText: 'Bulbasaur' }).first();
    await goalOption.waitFor({ state: 'visible' });
    await goalOption.click();
    await page.getByRole('checkbox', { name: 'Target HP' }).check();
    await goalDialog.getByRole('button', { name: 'Create Project' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Open the project detail page.
    await page.getByText('Test Project').click();
    await expect(page.getByRole('heading', { name: 'Test Project' })).toBeVisible();
    const detailUrl = page.url();

    // Use the global header button to log a captured Pokémon.
    await page.getByTestId('global-add-pokemon').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const speciesInput = page.getByRole('textbox', { name: 'Species' });
    await speciesInput.click();
    await speciesInput.fill('Charmander');
    const option = page.locator('[role="option"]', { hasText: 'Charmander' }).first();
    await option.waitFor({ state: 'visible' });
    await option.click();
    await dialog.getByRole('button', { name: 'Add Pokémon' }).click();

    // Back on the same project detail page, with a confirmation toast.
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page).toHaveURL(detailUrl);
    await expect(page.getByText('Pokémon added')).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:e2e -- global-add.spec.ts`
Expected: FAIL — `getByTestId('global-add-pokemon')` is not found (the button does not exist yet).

- [ ] **Step 3: Implement the header button**

Replace the entire contents of `src/components/AppLayout.tsx` with:

```tsx
import { AppShell, Burger, Group, NavLink, Title, Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { NavLink as RouterNavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

const navItems = [
  { label: 'Owned', to: '/owned' },
  { label: 'Projects', to: '/projects' },
  { label: 'Settings', to: '/settings' },
];

export function AppLayout() {
  const [opened, { toggle }] = useDisclosure();
  const navigate = useNavigate();
  const location = useLocation();

  function handleGlobalAdd() {
    const returnTo = location.pathname + location.search;
    navigate(`/owned?add=1&returnTo=${encodeURIComponent(returnTo)}`);
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 200, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Toggle navigation" />
            <Title order={3}>PokeMMO Breeding Calculator</Title>
          </Group>
          <Button size="sm" data-testid="global-add-pokemon" onClick={handleGlobalAdd}>
            Add Pokémon
          </Button>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <nav aria-label="Main navigation">
          {navItems.map((item) => (
            <RouterNavLink key={item.to} to={item.to} end>
              {({ isActive }) => (
                <NavLink
                  label={item.label}
                  active={isActive}
                  component="span"
                />
              )}
            </RouterNavLink>
          ))}
        </nav>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:e2e -- global-add.spec.ts`
Expected: PASS — all four tests in the file pass.

- [ ] **Step 5: Full verification gate**

Run: `npm run typecheck && npm run lint && npm run test:unit && npm run test:e2e`
Expected: PASS across the board (unit suite, full e2e suite including `owned.spec.ts` and `projects.spec.ts`, typecheck, lint).

- [ ] **Step 6: Commit**

```bash
git add src/components/AppLayout.tsx e2e/global-add.spec.ts
git commit -m "feat: global Add Pokémon button in app header"
```

---

## Done criteria

- A globally-available "Add Pokémon" button appears in the top-right of the header on every route.
- Clicking it opens a blank add form; submit adds the Pokémon, shows a toast, and returns to the originating page; cancel returns without adding.
- The newly added Pokémon is immediately available on the originating project page (reactive store).
- Existing Owned-page add/edit/delete behavior is unchanged (now with an "added" toast).
- `npm run typecheck && npm run lint && npm run test:unit && npm run test:e2e` all green.
