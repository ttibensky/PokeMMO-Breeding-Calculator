# Design: Eliminate React `act(...)` warnings in unit test output

**Date:** 2026-06-14
**Status:** Approved, ready for implementation plan

## Problem

Running `npm run test:unit` floods the console with repeated React warnings:

```
Warning: An update to @mantine/core/SegmentedControl inside a test was not
wrapped in act(...).
```

All 547 tests pass — this is pure console noise, not a test failure. But the
noise buries real signal and makes the suite output hard to read.

## Root cause

The warnings originate entirely from `src/features/settings/SettingsPage.test.tsx`.
`SettingsPage` calls `useMantineColorScheme()` (`SettingsPage.tsx:46`), and the
`SegmentedControl` it renders (`SettingsPage.tsx:416`) runs its own mount-time
measurement effect (`@mantine/core/.../SegmentedControl.mjs:40`). Both perform an
async `setState` **after** `render()`'s synchronous `act` scope has already
closed. React detects the state update happening outside `act` and warns.

Key facts establishing scope:

- **Mount-only.** No test in the file interacts with the color-scheme control.
  The warnings fire on render, not from any user interaction.
- **Interactions are already safe.** Every interaction uses synchronous
  `fireEvent` (lines 104, 149, 176, 203, 240, …), which React Testing Library
  already wraps in `act`. Nothing mid-test needs changing.
- **Single file.** `OwnedPokemonForm` also uses `SegmentedControl`
  (`OwnedPokemonForm.tsx:234`) but produces no warnings, so `SettingsPage.test.tsx`
  is the only file to change.

This is Mantine library-internal behavior under jsdom + Vitest, not a bug in the
project's test code.

## Approach

Make the test's `renderPage` helper flush pending post-mount effects inside an
`act` scope before tests query the DOM.

```ts
import { act, fireEvent, render, screen } from '@testing-library/react';

async function renderPage() {
  const result = render(
    <MantineProvider>
      <SettingsPage />
    </MantineProvider>,
  );
  await act(async () => {}); // flush Mantine's post-mount colorScheme/SegmentedControl updates
  return result;
}
```

`await act(async () => {})` drains the pending microtask/effect queue *inside* an
`act` scope, so the async `setState` React was complaining about now occurs where
React expects it. This is the idiomatic RTL pattern for library effects that
settle just after mount.

Because `renderPage` becomes async, all 41 `it(...)` call sites change from
`renderPage()` to `await renderPage()`. This is mechanical — one keyword per call
site. `act` is added to the existing `@testing-library/react` import.

### Why this approach

- **General.** It catches *both* warning sources (the `useMantineColorScheme`
  hook and the `SegmentedControl` measurement effect) regardless of which fires,
  because it flushes whatever async work is pending after mount.
- **Preserves signal.** Unlike suppressing `console.error`, the `act` warning
  remains fully active everywhere. A future test with a *genuine* missing-`act`
  bug would still be caught.
- **Rejected alternative — console filtering.** Wrapping `console.error` in
  `test-setup.ts` to drop the warning would be fewer lines but would hide the
  warning project-wide, losing its diagnostic value for future tests.
- **Rejected alternative — `defaultColorScheme` on the test provider.** Passing
  an explicit color scheme might silence the hook's update but not
  `SegmentedControl`'s own mount effect, and relies on assumptions about Mantine
  internals. The `act` flush is robust to both.

## Scope

- **Changes:** `src/features/settings/SettingsPage.test.tsx` only — async
  `renderPage`, `act` import, `await` at the 41 call sites.
- **No production code changes.** `SettingsPage.tsx` and all other source files
  are untouched.
- **No other test files changed.**

## Success criteria

1. `npm run test:unit` produces **zero** `act(...)` warnings in its output.
2. All 547 tests still pass (41 in `SettingsPage.test.tsx`).
3. `tsc -b` (typecheck) and `eslint .` (lint) remain green.
