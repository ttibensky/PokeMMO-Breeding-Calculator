# Breeding Tree Visualization — Design (Draft)

**Date:** 2026-06-14
**Status:** Draft — idea captured during brainstorm; needs full design before planning
**Tier:** 2 (high value, moderate complexity)

## Goal

Show the full breeding plan as a visual tree/pyramid — every parent pair and how
they combine upward to the final target Pokémon — instead of (or alongside) the
current linear step list.

## Context (what we know)

- The plan is produced by `src/engine/planner.ts` as a sequence of steps (parent
  pair, held items, forced gender, predicted offspring, cost).
- `src/engine/pyramid.ts` already does parity checks for breeding chains, implying
  the data has an inherent tree/pyramid shape to render.
- UI is React + Mantine; no graph/tree-drawing library is currently in the stack.

## Rough approach

- Derive a tree model from the existing plan steps (leaves = pool/acquired
  Pokémon, internal nodes = bred offspring, root = goal).
- Render it as a top-down pyramid where each node shows species sprite, key IVs,
  nature/ability, and held item.
- Decide between hand-rolled CSS/SVG layout vs. a lightweight tree library
  (dependency tradeoff — prefer no new heavy dep if CSS grid suffices).

## In scope

- Read-only visualization of an existing plan for a single project.

## Out of scope (for now)

- Editing the plan by manipulating the tree (drag/drop).
- Exporting the tree as an image (could be a follow-up tied to sharing).

## Open questions

- Replace the linear step list, or offer tree as a toggle/second view?
- Custom SVG/CSS vs. a tree-layout dependency — what's the size budget?
- How to render wide trees (6×31 goals) on mobile without horizontal overflow?

## Complexity / risk

Moderate. The data is already tree-shaped (`pyramid.ts`); main risk is layout for
large/wide trees and responsive behavior. No engine logic changes needed.
