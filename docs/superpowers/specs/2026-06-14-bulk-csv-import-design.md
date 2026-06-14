# Bulk / CSV Import — Design (Draft)

**Date:** 2026-06-14
**Status:** Draft — idea captured during brainstorm; needs full design before planning
**Tier:** 2 (useful, straightforward)

## Goal

Let users add many owned Pokémon at once by pasting/uploading data, instead of
entering each one through the single-record form.

## Context (what we know)

- Owned records: `src/store/ownedSlice.ts` (`OwnedPokemon` shape).
- An export/import of full data bundles already exists: `src/store/io.ts`
  (JSON serialization). That is whole-store backup/restore — distinct from
  appending many individual Pokémon to the pool.
- Single-entry form: `src/features/owned/OwnedPokemonForm`.

## Rough approach

- Add a "Bulk add" entry point on the Owned page: a textarea (paste CSV / rows)
  and/or file upload.
- Define a simple column format (species, IVs ×6, nature, ability, gender,
  shiny/alpha, egg moves, notes).
- Parse, validate row-by-row, show a preview with per-row errors, then commit the
  valid rows to the pool.

## In scope

- Appending many `OwnedPokemon` records from CSV/pasted text, with validation
  preview.

## Out of scope (for now)

- Importing projects/goals (covered by existing JSON import in `io.ts`).
- Scraping from in-game screenshots or external sites.

## Open questions

- Exact column format and whether to support a header row / flexible ordering.
- How to handle species name typos — reject, or fuzzy-match against the dataset?
- Paste-only for v1, or also file upload?

## Complexity / risk

Low–moderate. Main work is a robust parser + validation/preview UX. No engine or
migration risk; reuses the existing `OwnedPokemon` add path.
