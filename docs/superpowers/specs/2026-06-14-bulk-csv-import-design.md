# Bulk / CSV Import — Design

**Date:** 2026-06-15 (finalized; supersedes the 2026-06-14 draft)
**Status:** Approved — ready for implementation planning
**Tier:** 2 (useful, straightforward)

## Goal

Let users add many owned Pokémon at once by pasting rows or uploading a file,
instead of entering each one through the single-record form. The importer
appends `OwnedPokemon` records to the pool via the existing add path; it does
not touch the whole-store JSON backup/restore in `src/store/io.ts`.

## Context

- Owned records: `src/store/types.ts` (`OwnedPokemon`), added via
  `addOwnedPokemon(input: Omit<OwnedPokemon, 'id' | 'createdAt'>) => string`
  in `src/store/ownedSlice.ts`. `id` and `createdAt` are auto-generated.
- Field-derivation/validation helpers already used by the single-entry form
  live in `src/features/owned/ownedHelpers.ts`:
  - `allowedGenders(species)` — `['genderless']` | `['male']` | `['female']` |
    `['male','female']` based on `genderRate` / `isGenderless`.
  - `normalAbilities(species)` / `hiddenAbility(species)` — valid abilities.
  - `emptyIVs()` — all-zero IVs.
- Reference data: `NATURES` (`src/data/natures.ts`), and
  `getSpeciesById` / `getSpeciesByName` / `allSpecies` (`src/data/index.ts`).
  `OwnedPokemon.speciesId` is the **National Pokédex number**
  (`PokemonSpecies.id`).
- No fuzzy-match / string-distance utility exists in `src/` yet.
- Single-entry form: `src/features/owned/OwnedPokemonForm.tsx`.

The importer **reuses these helpers** so its validation matches the single-entry
form exactly, rather than inventing parallel rules.

## In scope

- A "Bulk add" entry point on the Owned page that appends many `OwnedPokemon`
  from pasted text or an uploaded file, with a validation preview and an
  all-or-nothing commit.

## Out of scope

- Importing projects/goals (covered by the existing JSON import in `io.ts`).
- Duplicate detection — re-importing a Pokémon already in the pool simply adds
  another record.
- Scraping from in-game screenshots or external sites.
- Auto-substituting fuzzy species matches (suggest only; never auto-accept).

## Input methods

Both feed the **same** parse → validate → preview pipeline:

- **Paste:** a textarea for pasted rows (the common "I built a list in a
  spreadsheet" flow).
- **Upload:** a file picker for `.csv` / `.tsv` / `.txt`; the file's text is read
  and dropped into the same pipeline (file-read errors surface as a top-level
  message).

## Input format

Header-based with a forgiving subset; only the species is mandatory.

- **Header row required.** Column names are matched case-insensitively and
  trimmed. **Unknown columns are ignored**, and the preview shows an info note
  listing any it ignored.
- **Delimiter auto-detected: comma or tab.** This makes a direct spreadsheet
  copy-paste (which is tab-separated) work without saving a file. Fields may be
  quoted RFC-4180 style (double quotes, `""` to escape a quote) so `notes` can
  contain the delimiter.
- **Species resolution:** when a `dexId` column is present and its value is a
  valid national dex number, it is **preferred**. Otherwise the `species` name
  is resolved (trimmed, case-insensitive). Every row must resolve to a species
  by one of these paths.
- **Only species is mandatory.** Every other column is optional; when its column
  is absent — or a cell is blank — the field takes its default.

### Columns

| Column (aliases) | Default | Validation |
|---|---|---|
| `dexId` / `id` | — | integer; must exist via `getSpeciesById` |
| `species` / `name` | — | resolved via `getSpeciesByName`; on miss, a fuzzy **suggestion** is offered (never auto-accepted) |
| `ivs` | `0/0/0/0/0/0` | exactly six `/`-separated integers in **HP/Atk/Def/SpA/SpD/Spe** order, each 0–31 |
| `nature` | `Hardy` (`NATURES[0]`) | must be in `NATURES` (case-insensitive) |
| `ability` | species' primary (first normal) ability | must be a valid ability for the resolved species; `isHiddenAbility` is derived from whether the matched ability is the hidden one |
| `gender` | first of `allowedGenders(species)` | must be in `allowedGenders(species)` |
| `shiny` | `false` | boolean token |
| `alpha` | `false` | boolean token (**independent of `shiny`** — an alpha need not be shiny, and vice-versa) |
| `eggMoves` | `[]` | `;`-separated list; each move must be in `species.moves` (case-insensitive) |
| `notes` | `""` | free text |

**Boolean tokens** (case-insensitive): `true`/`false`, `yes`/`no`, `y`/`n`,
`1`/`0`. Any other value is a row error.

### Deliberate validation choices

- **Out-of-range / non-integer IVs are a row error, not silently clamped.** The
  single-entry form clamps live as you type; for a bulk paste, silently clamping
  across many rows would hide mistakes, so the importer rejects the row instead.
- **Egg moves use `;` as the in-cell separator**, because `,` and tab are the
  column delimiters.
- **Species ID resolution wins over name.** If both columns are present and the
  `dexId` is valid, the name is ignored (and not error-checked); if the `dexId`
  is invalid/blank, fall back to the name.

## Architecture

A pure core plus a thin UI, under `src/features/owned/bulkImport/`:

1. **`parseCsv.ts`** — pure. Raw text → `string[][]` (rows of cells). Handles
   delimiter detection (comma vs tab), quoted fields, CRLF, blank lines, and a
   trailing newline. No app/domain knowledge.

2. **`validateRows.ts`** — pure. Parsed rows + a resolved header map →
   `ParsedRow[]`, where each entry is either
   `{ ok: true, value: Omit<OwnedPokemon, 'id' | 'createdAt'> }` or
   `{ ok: false, errors: RowError[], raw: string[], suggestion?: string }`.
   This is the heart of the feature: it applies the column rules above, reuses
   `ownedHelpers` + the dataset, and contains a small local Levenshtein-based
   suggester (used only to suggest the closest species name on a miss).

3. **`BulkImportModal.tsx`** — UI only. Textarea + file input → runs
   `parseCsv` then `validateRows` → renders the preview → commits. On commit it
   loops the valid rows through `addOwnedPokemon`, closes, and fires a success
   notification with the count added.

**Entry point:** a "Bulk add" button on the Owned page, alongside the
single-entry form.

**Data flow:** `text (paste | file read)` → `parseCsv` → `validateRows` →
`preview state` → `commit` → `addOwnedPokemon` per valid row.

## Preview & commit (all-or-nothing)

The preview is a table with one row per parsed record:

- Row number, resolved species (sprite + name), a compact summary of the
  derived fields, and per-row **error chips** for any failures (with the fuzzy
  suggestion shown inline when a species name didn't resolve).
- An **info note** listing any ignored unknown columns.

**Commit is disabled until every row validates.** When enabled, the button
shows the count (e.g. "Add 12 Pokémon"). Top-level messages cover empty input,
a missing/unrecognizable header row, and file-read errors.

The user fixes the source text (or file) and re-parses until all rows are valid,
then commits the whole batch at once.

## Error handling

| Condition | Handling |
|---|---|
| Empty input | Top-level message; commit disabled. |
| No recognizable header row | Top-level message listing the expected columns; commit disabled. |
| File read failure | Top-level message; pipeline not run. |
| Unknown columns present | Ignored; info note lists them. |
| Any row invalid | Per-row error chips; commit disabled (all-or-nothing). |

## Testing

- **Unit (Vitest), co-located `*.test.ts`:**
  - `parseCsv` — comma vs tab detection, quoted fields with embedded
    delimiters, `""` escaping, CRLF, blank lines, trailing newline.
  - `validateRows` — every field default; every error type; `dexId`-over-name
    precedence; fuzzy suggestion on species miss; gender constraint per
    `allowedGenders`; hidden-ability flag derivation; the `ivs` column (exactly
    six values, range 0–31, malformed counts); egg-move membership; boolean
    token parsing; unknown-column reporting.
- **E2E (Playwright):** navigate to `/#/owned` (hash route), open the Bulk add
  modal, paste a small valid CSV → preview shows all rows valid → commit →
  assert the pool count rose; paste a CSV with one bad row → assert commit is
  disabled and the error chip is shown. Use scoped `data-testid` selectors.

## Complexity / risk

Low–moderate. The bulk of the work is a robust parser plus the
validation/preview UX. No engine or migration risk; it reuses the existing
`OwnedPokemon` add path and the form's validation helpers.
