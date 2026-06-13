# Dark Mode — Design

**Date:** 2026-06-13
**Status:** Approved, ready for implementation plan

## Goal

Add a dark mode to the PokeMMO Breeding Calculator with a Light / Dark / Auto
choice, controlled from the Settings page.

## Context

The app is built on **Mantine v7**, which has first-class color-scheme support.
Colors are not hardcoded — they flow from Mantine's palette and respond to the
active color scheme automatically. The only thing actively blocking dark mode is
`forceColorScheme="light"` on the `MantineProvider` in `src/main.tsx`.

App settings (prices, features, mechanics) persist through a Zustand store and
are part of an import/export feature. The theme choice is intentionally **kept
out** of that store — it is a per-device display preference, and Mantine manages
its own persistence.

## Approach

Lean entirely on Mantine's native color-scheme system. No custom theme state, no
CSS variables, no color migration.

## Changes

1. **`src/main.tsx`** — Remove `forceColorScheme="light"` from `MantineProvider`
   and set `defaultColorScheme="auto"`. This unblocks dark mode and makes "Auto"
   follow the OS/browser preference.

2. **`index.html`** (or `src/main.tsx`) — Add Mantine's `ColorSchemeScript` so the
   saved scheme is applied before first paint, preventing a flash of light mode
   on reload.

3. **`src/features/settings/SettingsPage.tsx`** — Add an "Appearance" section
   containing a `SegmentedControl` with options **Light / Dark / Auto**, bound to
   Mantine's `useMantineColorScheme()` hook (`colorScheme` value +
   `setColorScheme` setter).

4. **Persistence** — Handled automatically by Mantine via its own localStorage
   key. No changes to the Zustand store or to import/export.

## Data flow

`SegmentedControl` → `setColorScheme('light' | 'dark' | 'auto')` → Mantine writes
its localStorage key and updates the `data-mantine-color-scheme` attribute on the
`<html>` element → all Mantine components re-render in the new palette.

## Testing

Playwright e2e (this is a behavioral/visual change):

- Navigate to the Settings page, set the scheme to **Dark**.
- Assert the `<html>` element carries the dark color-scheme attribute.
- Reload the page and assert the dark scheme persisted.

Prefer extending the existing settings spec over adding a new file.

## Out of scope (YAGNI)

- Custom dark palette tuning or per-component color overrides.
- Including the theme choice in settings export/import.
- A header quick-toggle (Settings page only, per design decision).

## Known risk

The design assumes Mantine's default palette covers all UI. If a component uses a
hardcoded color that looks wrong in dark mode (e.g. sprite rendering or a manually
styled element), it will surface during verification and be handled as a small
follow-up.
