# Project card whole-box navigation — design

**Date:** 2026-06-13
**Status:** Approved

## Problem

On the Projects list, a project is rendered as a `ProjectCard`. Only the **title**
is a link to the detail view (`/projects/:id`). Users expect the whole card to be
clickable, not just the title text.

## Goal

Clicking anywhere on a project card navigates to the project detail view
(`/projects/:id`), except the edit and delete icons, which keep their existing
behavior and must not navigate.

## Scope

- **In scope:** `ProjectCard` in `src/features/projects/ProjectsPage.tsx` (lines ~30–120).
- **Out of scope:** routing, the edit modal, delete confirmation, the detail page
  (`ProjectDetailPage`), and the Owned Pokémon list.

## Behavior

- Clicking anywhere on a project card → navigate to `/projects/:id` (detail view).
- Clicking the edit icon (✏️) → opens the edit modal, does **not** navigate.
- Clicking the delete icon (🗑️) → triggers delete confirmation, does **not** navigate.
- The title is no longer styled as a standalone link; it reads as the card's normal
  heading. The whole card carries the clickable affordance (hover cursor / subtle
  elevation).

## Implementation — stretched-link pattern

Chosen for proper link semantics without the accessibility footwork of a
programmatic click handler and without the invalid nested-interactive-element markup
of rendering the whole `Card` as an anchor.

1. **Keep a real anchor.** The title keeps a real `<Link to={`/projects/${project.id}`}>`
   so it remains the genuine navigation target — focusable, keyboard-activatable, and
   supporting Cmd/middle-click "open in new tab". Restyle it as plain heading text
   (drop link color/underline).
2. **Stretch the link over the card.** Give the `Card` `position: relative`. Give the
   title link an absolutely-positioned overlay that fills the card (a `::after`
   pseudo-element or an explicit overlay element), so a click anywhere on the card
   resolves to that link.
3. **Keep the icons clickable.** Give the edit/delete `ActionIcon` group
   `position: relative` and a `z-index` above the overlay, so they sit on top and stay
   independently clickable. No `stopPropagation` needed — the overlay simply does not
   cover them.
4. **Affordance.** Add `cursor: pointer` and a subtle hover elevation on the card so it
   reads as clickable.

## What does not change

Routes, the edit modal, delete confirmation, the detail page, and the Owned Pokémon
list all remain as-is.

## Testing

This is observable/behavioral, so **e2e (Playwright)** — extend the projects spec:

1. Clicking the card body navigates to `/projects/:id`.
2. Clicking the edit icon opens the edit modal and does **not** navigate.
3. Clicking the delete icon triggers delete confirmation and does **not** navigate.
