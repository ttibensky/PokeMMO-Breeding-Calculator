# Bulk / CSV Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users add many `OwnedPokemon` to the pool at once by pasting rows or uploading a CSV/TSV file, with a validation preview and an all-or-nothing commit.

**Architecture:** A pure core (`parseCsv` text→grid, `suggest` fuzzy species names, `validateRows` grid→validated/erroring rows) under `src/features/owned/bulkImport/`, plus a thin Mantine `BulkImportModal` opened from a new "Bulk add" button on the Owned page. The validator reuses the single-entry form's helpers (`allowedGenders`, `normalAbilities`/`hiddenAbility`, `emptyIVs`, `NATURES`, `getSpeciesById`/`getSpeciesByName`) so import validation matches the form exactly.

**Tech Stack:** React + TypeScript, Mantine (`Modal`, `Textarea`, `FileButton`, `Table`, `@mantine/notifications`), Zustand store (`useBreedingStore`), Vitest (unit), Playwright (e2e).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/features/owned/bulkImport/parseCsv.ts` (create) | Pure: raw text → `string[][]`. Delimiter detection (comma/tab), quoted fields, CRLF, blank-line skip. |
| `src/features/owned/bulkImport/parseCsv.test.ts` (create) | Unit tests for `parseDelimited` / `detectDelimiter`. |
| `src/features/owned/bulkImport/suggest.ts` (create) | Pure: `levenshtein` + `suggestSpecies` (closest dataset name on a miss). |
| `src/features/owned/bulkImport/suggest.test.ts` (create) | Unit tests for the suggester. |
| `src/features/owned/bulkImport/validateRows.ts` (create) | Pure: grid → `ParsedRow[]` + unknown columns + header error. The validation heart. |
| `src/features/owned/bulkImport/validateRows.test.ts` (create) | Unit tests for every column rule, default, and error. |
| `src/features/owned/bulkImport/BulkImportModal.tsx` (create) | UI only: textarea + file input → parse → preview table → all-or-nothing commit via `addOwnedPokemon`. |
| `src/features/owned/OwnedPage.tsx` (modify) | Add a "Bulk add" button + modal state. |
| `e2e/owned-bulk-import.spec.ts` (create) | E2E: paste valid CSV → commit → pool grows; bad row → commit disabled + error shown. |

Import-depth note: files under `bulkImport/` reach the store as `../../../store/index`, data as `../../../data/index`, and the owned helpers as `../ownedHelpers`.

---

## Task 1: CSV/TSV parser (`parseCsv.ts`)

**Files:**
- Create: `src/features/owned/bulkImport/parseCsv.ts`
- Test: `src/features/owned/bulkImport/parseCsv.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/owned/bulkImport/parseCsv.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { detectDelimiter, parseDelimited } from './parseCsv';

describe('detectDelimiter', () => {
  it('picks comma by default', () => {
    expect(detectDelimiter('species,ivs\nBulbasaur,31/31/31/31/31/31')).toBe(',');
  });
  it('picks tab when the header has more tabs than commas', () => {
    expect(detectDelimiter('species\tivs\nBulbasaur\t31/31/31/31/31/31')).toBe('\t');
  });
});

describe('parseDelimited', () => {
  it('parses simple comma rows', () => {
    expect(parseDelimited('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('parses tab rows', () => {
    expect(parseDelimited('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('keeps commas inside quoted fields', () => {
    expect(parseDelimited('a,b\n"x,y",2')).toEqual([['a', 'b'], ['x,y', '2']]);
  });
  it('unescapes doubled quotes inside quoted fields', () => {
    expect(parseDelimited('a\n"he said ""hi"""')).toEqual([['a'], ['he said "hi"']]);
  });
  it('handles CRLF line endings', () => {
    expect(parseDelimited('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('skips fully blank lines and a trailing newline', () => {
    expect(parseDelimited('a,b\n\n1,2\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/features/owned/bulkImport/parseCsv.test.ts`
Expected: FAIL — `parseCsv.ts` does not exist / no exports.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/owned/bulkImport/parseCsv.ts`:

```ts
export function detectDelimiter(text: string): '\t' | ',' {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim() !== '') ?? '';
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return tabs > commas ? '\t' : ',';
}

/**
 * Parse delimited text (comma or tab, auto-detected) into rows of cells.
 * Supports RFC-4180 style quoting: double-quoted fields may contain the
 * delimiter, and `""` is an escaped quote. Fully blank lines are dropped.
 */
export function parseDelimited(text: string): string[][] {
  const delim = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      pushField();
    } else if (ch === '\r') {
      // ignore; handled by the following \n
    } else if (ch === '\n') {
      pushRow();
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) pushRow();

  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/features/owned/bulkImport/parseCsv.test.ts`
Expected: PASS (all 8 cases).

- [ ] **Step 5: Commit**

```bash
git add src/features/owned/bulkImport/parseCsv.ts src/features/owned/bulkImport/parseCsv.test.ts
git commit -m "feat(bulk-import): add delimited CSV/TSV parser"
```

---

## Task 2: Fuzzy species suggester (`suggest.ts`)

**Files:**
- Create: `src/features/owned/bulkImport/suggest.ts`
- Test: `src/features/owned/bulkImport/suggest.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/owned/bulkImport/suggest.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { levenshtein, suggestSpecies } from './suggest';

describe('levenshtein', () => {
  it('is zero for identical strings', () => {
    expect(levenshtein('pikachu', 'pikachu')).toBe(0);
  });
  it('counts single-character edits', () => {
    expect(levenshtein('charizad', 'charizard')).toBe(1);
  });
});

describe('suggestSpecies', () => {
  it('suggests the closest real species for a near-miss', () => {
    // "Charizad" is one deletion from "Charizard".
    expect(suggestSpecies('Charizad')).toBe('Charizard');
  });
  it('returns undefined when nothing is close enough', () => {
    expect(suggestSpecies('zzzzzzzzzz')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/features/owned/bulkImport/suggest.test.ts`
Expected: FAIL — `suggest.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/owned/bulkImport/suggest.ts`:

```ts
import { allSpecies } from '../../../data/index';

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Closest dataset species name to `name`, or undefined if none is close enough. */
export function suggestSpecies(name: string): string | undefined {
  const target = name.trim().toLowerCase();
  if (target === '') return undefined;
  let best: { name: string; dist: number } | undefined;
  for (const s of allSpecies) {
    const d = levenshtein(target, s.name.toLowerCase());
    if (best === undefined || d < best.dist) best = { name: s.name, dist: d };
  }
  const threshold = Math.max(2, Math.floor(target.length * 0.34));
  return best && best.dist <= threshold ? best.name : undefined;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/features/owned/bulkImport/suggest.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/owned/bulkImport/suggest.ts src/features/owned/bulkImport/suggest.test.ts
git commit -m "feat(bulk-import): add fuzzy species-name suggester"
```

---

## Task 3: Row validator (`validateRows.ts`)

**Files:**
- Create: `src/features/owned/bulkImport/validateRows.ts`
- Test: `src/features/owned/bulkImport/validateRows.test.ts`

The validator is data-driven in tests: rather than hard-coding ability/move strings, the tests read expected values from the dataset via `getSpeciesByName` and the owned helpers, so they stay correct if the bundled dataset changes.

- [ ] **Step 1: Write the failing test**

Create `src/features/owned/bulkImport/validateRows.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateRows } from './validateRows';
import { allSpecies, getSpeciesByName } from '../../../data/index';
import { allowedGenders, normalAbilities, hiddenAbility } from '../ownedHelpers';

const bulbasaur = getSpeciesByName('Bulbasaur')!;
const ditto = getSpeciesByName('Ditto')!; // genderless

function rowsOf(text: string[][]) {
  return validateRows(text);
}

describe('validateRows — header handling', () => {
  it('errors when neither species nor dexId column is present', () => {
    const res = rowsOf([['nature'], ['Modest']]);
    expect(res.headerError).toBeTruthy();
    expect(res.rows).toEqual([]);
  });
  it('reports unknown columns and ignores them', () => {
    const res = rowsOf([['species', 'foo'], ['Bulbasaur', 'bar']]);
    expect(res.unknownColumns).toEqual(['foo']);
    expect(res.rows[0].ok).toBe(true);
  });
});

describe('validateRows — defaults', () => {
  it('applies defaults when only species is given', () => {
    const res = rowsOf([['species'], ['Bulbasaur']]);
    const row = res.rows[0];
    expect(row.ok).toBe(true);
    if (!row.ok) return;
    expect(row.value.speciesId).toBe(bulbasaur.id);
    expect(row.value.ivs).toEqual({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
    expect(row.value.nature).toBe('Hardy');
    expect(row.value.ability).toBe(normalAbilities(bulbasaur)[0]);
    expect(row.value.gender).toBe(allowedGenders(bulbasaur)[0]);
    expect(row.value.isShiny).toBe(false);
    expect(row.value.isAlpha).toBe(false);
    expect(row.value.eggMoves).toEqual([]);
    expect(row.value.notes).toBeUndefined();
  });
});

describe('validateRows — species resolution', () => {
  it('prefers a valid dexId over the name', () => {
    const res = rowsOf([['dexId', 'species'], [String(bulbasaur.id), 'Charizard']]);
    const row = res.rows[0];
    expect(row.ok && row.value.speciesId).toBe(bulbasaur.id);
  });
  it('falls back to the name when dexId is invalid', () => {
    const res = rowsOf([['dexId', 'species'], ['999999', 'Bulbasaur']]);
    const row = res.rows[0];
    expect(row.ok && row.value.speciesId).toBe(bulbasaur.id);
  });
  it('errors with a suggestion on an unknown species name', () => {
    const res = rowsOf([['species'], ['Bulbasuar']]);
    const row = res.rows[0];
    expect(row.ok).toBe(false);
    if (row.ok) return;
    expect(row.errors[0].field).toBe('species');
    expect(row.suggestion).toBe('Bulbasaur');
  });
});

describe('validateRows — ivs', () => {
  it('parses six slash-separated values in hp/atk/def/spa/spd/spe order', () => {
    const res = rowsOf([['species', 'ivs'], ['Bulbasaur', '31/0/30/29/28/27']]);
    const row = res.rows[0];
    expect(row.ok && row.value.ivs).toEqual({ hp: 31, atk: 0, def: 30, spa: 29, spd: 28, spe: 27 });
  });
  it('errors when the ivs cell does not have exactly six values', () => {
    const res = rowsOf([['species', 'ivs'], ['Bulbasaur', '31/31/31']]);
    const row = res.rows[0];
    expect(row.ok).toBe(false);
    if (!row.ok) expect(row.errors[0].field).toBe('ivs');
  });
  it('errors on an out-of-range iv', () => {
    const res = rowsOf([['species', 'ivs'], ['Bulbasaur', '32/0/0/0/0/0']]);
    const row = res.rows[0];
    expect(row.ok).toBe(false);
    if (!row.ok) expect(row.errors[0].field).toBe('ivs');
  });
});

describe('validateRows — nature, ability, gender', () => {
  it('matches nature case-insensitively and canonicalizes it', () => {
    const res = rowsOf([['species', 'nature'], ['Bulbasaur', 'modest']]);
    expect(res.rows[0].ok && (res.rows[0] as any).value.nature).toBe('Modest');
  });
  it('errors on an unknown nature', () => {
    const res = rowsOf([['species', 'nature'], ['Bulbasaur', 'Sneaky']]);
    expect(res.rows[0].ok).toBe(false);
  });
  it('derives isHiddenAbility when the hidden ability is named', () => {
    const withHidden = allSpecies.find((s) => hiddenAbility(s));
    expect(withHidden).toBeTruthy();
    const ha = hiddenAbility(withHidden!)!;
    const res = rowsOf([['species', 'ability'], [withHidden!.name, ha]]);
    const row = res.rows[0];
    expect(row.ok && row.value.ability).toBe(ha);
    expect(row.ok && row.value.isHiddenAbility).toBe(true);
  });
  it('errors on an ability the species cannot have', () => {
    const res = rowsOf([['species', 'ability'], ['Bulbasaur', 'NotARealAbility']]);
    expect(res.rows[0].ok).toBe(false);
  });
  it('rejects a gender the species cannot be', () => {
    const res = rowsOf([['species', 'gender'], ['Ditto', 'male']]);
    expect(res.rows[0].ok).toBe(false);
    expect(allowedGenders(ditto)).toEqual(['genderless']);
  });
});

describe('validateRows — booleans and egg moves', () => {
  it('parses boolean tokens for shiny and alpha independently', () => {
    const res = rowsOf([['species', 'shiny', 'alpha'], ['Bulbasaur', 'yes', 'no']]);
    const row = res.rows[0];
    expect(row.ok && row.value.isShiny).toBe(true);
    expect(row.ok && row.value.isAlpha).toBe(false);
  });
  it('errors on an invalid boolean token', () => {
    const res = rowsOf([['species', 'shiny'], ['Bulbasaur', 'maybe']]);
    expect(res.rows[0].ok).toBe(false);
  });
  it('resolves semicolon-separated egg moves against the species move list', () => {
    const move = bulbasaur.moves[0];
    const res = rowsOf([['species', 'eggMoves'], ['Bulbasaur', move.toLowerCase()]]);
    const row = res.rows[0];
    expect(row.ok && row.value.eggMoves).toEqual([move]);
  });
  it('errors on an egg move the species cannot learn', () => {
    const res = rowsOf([['species', 'eggMoves'], ['Bulbasaur', 'NotAMove']]);
    expect(res.rows[0].ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/features/owned/bulkImport/validateRows.test.ts`
Expected: FAIL — `validateRows.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/owned/bulkImport/validateRows.ts`:

```ts
import type { Gender, IVs, OwnedPokemon } from '../../../store/types';
import type { PokemonSpecies } from '../../../data/types';
import { getSpeciesById, getSpeciesByName } from '../../../data/index';
import { NATURES } from '../../../data/natures';
import { allowedGenders, emptyIVs, hiddenAbility, normalAbilities } from '../ownedHelpers';
import { suggestSpecies } from './suggest';

export type RowInput = Omit<OwnedPokemon, 'id' | 'createdAt'>;

export interface RowError {
  field: string;
  message: string;
}

export type ParsedRow =
  | { ok: true; value: RowInput }
  | { ok: false; errors: RowError[]; raw: string[]; suggestion?: string };

export interface ValidateResult {
  rows: ParsedRow[];
  unknownColumns: string[];
  headerError?: string;
}

type CanonicalColumn =
  | 'dexId'
  | 'species'
  | 'ivs'
  | 'nature'
  | 'ability'
  | 'gender'
  | 'shiny'
  | 'alpha'
  | 'eggMoves'
  | 'notes';

const STAT_ORDER: (keyof IVs)[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

const COLUMN_ALIASES: Record<string, CanonicalColumn> = {
  dexid: 'dexId',
  id: 'dexId',
  species: 'species',
  name: 'species',
  pokemon: 'species',
  ivs: 'ivs',
  nature: 'nature',
  ability: 'ability',
  gender: 'gender',
  shiny: 'shiny',
  alpha: 'alpha',
  eggmoves: 'eggMoves',
  'egg moves': 'eggMoves',
  notes: 'notes',
};

const RECOGNIZED_LIST = 'dexId, species, ivs, nature, ability, gender, shiny, alpha, eggMoves, notes';

const TRUE_TOKENS = new Set(['true', 'yes', 'y', '1']);
const FALSE_TOKENS = new Set(['false', 'no', 'n', '0', '']);

function parseBool(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (TRUE_TOKENS.has(v)) return true;
  if (FALSE_TOKENS.has(v)) return false;
  return null;
}

function parseIvs(raw: string): { ivs?: IVs; error?: string } {
  const parts = raw.split('/').map((p) => p.trim());
  if (parts.length !== 6) {
    return { error: `IVs must be 6 values separated by "/", got ${parts.length}` };
  }
  const ivs = emptyIVs();
  for (let i = 0; i < 6; i++) {
    const n = Number(parts[i]);
    if (!Number.isInteger(n) || n < 0 || n > 31) {
      return { error: `IV "${parts[i]}" must be an integer 0–31` };
    }
    ivs[STAT_ORDER[i]] = n;
  }
  return { ivs };
}

function buildHeaderMap(header: string[]): {
  map: Partial<Record<CanonicalColumn, number>>;
  unknown: string[];
} {
  const map: Partial<Record<CanonicalColumn, number>> = {};
  const unknown: string[] = [];
  header.forEach((h, idx) => {
    const key = COLUMN_ALIASES[h.trim().toLowerCase()];
    if (key) {
      if (map[key] === undefined) map[key] = idx;
    } else if (h.trim() !== '') {
      unknown.push(h.trim());
    }
  });
  return { map, unknown };
}

function validateRow(cells: string[], map: Partial<Record<CanonicalColumn, number>>): ParsedRow {
  const get = (col: CanonicalColumn): string => {
    const idx = map[col];
    return idx === undefined ? '' : (cells[idx] ?? '').trim();
  };
  const errors: RowError[] = [];

  // --- species resolution: dexId wins, then name ---
  let species: PokemonSpecies | undefined;
  const dexRaw = get('dexId');
  if (dexRaw !== '') {
    const n = Number(dexRaw);
    if (Number.isInteger(n)) species = getSpeciesById(n);
  }
  const nameRaw = get('species');
  if (!species && nameRaw !== '') species = getSpeciesByName(nameRaw);
  if (!species) {
    const suggestion = nameRaw !== '' ? suggestSpecies(nameRaw) : undefined;
    const label = nameRaw || dexRaw;
    const message = label ? `Unknown species "${label}"` : 'Missing species';
    return { ok: false, errors: [{ field: 'species', message }], raw: cells, suggestion };
  }

  // --- ivs ---
  let ivs = emptyIVs();
  const ivsRaw = get('ivs');
  if (ivsRaw !== '') {
    const r = parseIvs(ivsRaw);
    if (r.error) errors.push({ field: 'ivs', message: r.error });
    else ivs = r.ivs!;
  }

  // --- nature ---
  let nature = NATURES[0]; // 'Hardy'
  const natRaw = get('nature');
  if (natRaw !== '') {
    const match = NATURES.find((nm) => nm.toLowerCase() === natRaw.toLowerCase());
    if (match) nature = match;
    else errors.push({ field: 'nature', message: `Unknown nature "${natRaw}"` });
  }

  // --- ability (+ derived isHiddenAbility) ---
  const normals = normalAbilities(species);
  const hidden = hiddenAbility(species);
  const validAbilities = [...normals, ...(hidden ? [hidden] : [])];
  let ability = normals[0] ?? hidden ?? '';
  const abRaw = get('ability');
  if (abRaw !== '') {
    const match = validAbilities.find((a) => a.toLowerCase() === abRaw.toLowerCase());
    if (match) ability = match;
    else errors.push({ field: 'ability', message: `"${abRaw}" is not an ability of ${species.name}` });
  }
  const isHiddenAbility = hidden !== undefined && ability === hidden;

  // --- gender ---
  const allowed = allowedGenders(species);
  let gender: Gender = allowed[0];
  const gRaw = get('gender');
  if (gRaw !== '') {
    const match = allowed.find((x) => x === gRaw.toLowerCase());
    if (match) gender = match;
    else errors.push({ field: 'gender', message: `Gender must be one of ${allowed.join(', ')} for ${species.name}` });
  }

  // --- shiny / alpha (independent) ---
  let isShiny = false;
  const shinyParsed = parseBool(get('shiny'));
  if (shinyParsed === null) errors.push({ field: 'shiny', message: `Invalid boolean "${get('shiny')}"` });
  else isShiny = shinyParsed;

  let isAlpha = false;
  const alphaParsed = parseBool(get('alpha'));
  if (alphaParsed === null) errors.push({ field: 'alpha', message: `Invalid boolean "${get('alpha')}"` });
  else isAlpha = alphaParsed;

  // --- egg moves ---
  let eggMoves: string[] = [];
  const emRaw = get('eggMoves');
  if (emRaw !== '') {
    const requested = emRaw.split(';').map((m) => m.trim()).filter((m) => m !== '');
    const resolved: string[] = [];
    const invalid: string[] = [];
    for (const move of requested) {
      const match = species.moves.find((mv) => mv.toLowerCase() === move.toLowerCase());
      if (match) resolved.push(match);
      else invalid.push(move);
    }
    if (invalid.length) errors.push({ field: 'eggMoves', message: `${species.name} can't learn: ${invalid.join(', ')}` });
    else eggMoves = resolved;
  }

  // --- notes ---
  const notes = get('notes');

  if (errors.length) return { ok: false, errors, raw: cells };

  const value: RowInput = {
    speciesId: species.id,
    ivs,
    nature,
    ability,
    isHiddenAbility,
    gender,
    isShiny,
    isAlpha,
    eggMoves,
    ...(notes !== '' ? { notes } : {}),
  };
  return { ok: true, value };
}

export function validateRows(grid: string[][]): ValidateResult {
  if (grid.length === 0) {
    return { rows: [], unknownColumns: [], headerError: 'No data found.' };
  }
  const [header, ...dataRows] = grid;
  const { map, unknown } = buildHeaderMap(header);
  if (map.species === undefined && map.dexId === undefined) {
    return {
      rows: [],
      unknownColumns: unknown,
      headerError: `No "species" or "dexId" column found. Recognized columns: ${RECOGNIZED_LIST}.`,
    };
  }
  const rows = dataRows.map((cells) => validateRow(cells, map));
  return { rows, unknownColumns: unknown };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/features/owned/bulkImport/validateRows.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/features/owned/bulkImport/validateRows.ts src/features/owned/bulkImport/validateRows.test.ts
git commit -m "feat(bulk-import): add row validator with defaults and per-row errors"
```

---

## Task 4: Bulk import modal + Owned page entry point

**Files:**
- Create: `src/features/owned/bulkImport/BulkImportModal.tsx`
- Modify: `src/features/owned/OwnedPage.tsx`

This task is UI/behavioral; its test is the e2e spec in Task 5 (per the project testing policy, observable UI behavior is covered by Playwright, not a Mantine render unit test).

- [ ] **Step 1: Create the modal component**

Create `src/features/owned/bulkImport/BulkImportModal.tsx`:

```tsx
import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  FileButton,
  Group,
  Stack,
  Table,
  Text,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useBreedingStore } from '../../../store/index';
import { getSpeciesById } from '../../../data/index';
import { formatIVs } from '../ownedHelpers';
import { parseDelimited } from './parseCsv';
import { validateRows, type ValidateResult } from './validateRows';

interface BulkImportModalProps {
  opened: boolean;
  onClose: () => void;
}

const TEMPLATE = 'species,ivs,nature,ability,gender,shiny,alpha,eggMoves,notes';

export function BulkImportModal({ opened, onClose }: BulkImportModalProps) {
  const addOwnedPokemon = useBreedingStore((s) => s.addOwnedPokemon);
  const [text, setText] = useState('');
  const [result, setResult] = useState<ValidateResult | null>(null);

  const reset = () => {
    setText('');
    setResult(null);
  };
  const handleClose = () => {
    reset();
    onClose();
  };

  const runParse = (value: string) => {
    setText(value);
    setResult(value.trim() === '' ? null : validateRows(parseDelimited(value)));
  };

  const handleFile = (file: File | null) => {
    if (!file) return;
    file
      .text()
      .then((content) => runParse(content))
      .catch(() => setResult({ rows: [], unknownColumns: [], headerError: 'Could not read that file.' }));
  };

  const allValid =
    result !== null &&
    !result.headerError &&
    result.rows.length > 0 &&
    result.rows.every((r) => r.ok);

  const handleCommit = () => {
    if (!result || !allValid) return;
    let count = 0;
    for (const row of result.rows) {
      if (row.ok) {
        addOwnedPokemon(row.value);
        count++;
      }
    }
    notifications.show({ message: `Added ${count} Pokémon`, color: 'green' });
    handleClose();
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="Bulk add Pokémon" size="xl">
      <Stack>
        <Text size="sm" c="dimmed">
          Paste rows (CSV or tab-separated) or upload a file. A header row is required; only{' '}
          <code>species</code> (or <code>dexId</code>) is mandatory. Columns: {TEMPLATE}.
        </Text>

        <Textarea
          data-testid="bulk-import-textarea"
          aria-label="Bulk import data"
          autosize
          minRows={6}
          placeholder={TEMPLATE}
          value={text}
          onChange={(e) => runParse(e.currentTarget.value)}
        />

        <Group>
          <FileButton onChange={handleFile} accept=".csv,.tsv,.txt">
            {(props) => (
              <Button {...props} variant="default" data-testid="bulk-import-file">
                Upload file
              </Button>
            )}
          </FileButton>
        </Group>

        {result?.headerError && (
          <Alert color="red" data-testid="bulk-import-header-error">
            {result.headerError}
          </Alert>
        )}

        {result && result.unknownColumns.length > 0 && (
          <Alert color="yellow">Ignored unknown columns: {result.unknownColumns.join(', ')}</Alert>
        )}

        {result && !result.headerError && result.rows.length > 0 && (
          <Table striped withTableBorder data-testid="bulk-import-preview">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                <Table.Th>Pokémon</Table.Th>
                <Table.Th>Details</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {result.rows.map((row, i) => (
                <Table.Tr key={i}>
                  <Table.Td>{i + 1}</Table.Td>
                  <Table.Td>
                    {row.ok ? getSpeciesById(row.value.speciesId)?.name : row.raw.join(' | ')}
                  </Table.Td>
                  <Table.Td>
                    {row.ok ? (
                      <Text size="xs">
                        {row.value.nature} · {row.value.gender} · {row.value.ability} ·{' '}
                        {formatIVs(row.value.ivs)}
                        {row.value.isShiny ? ' · shiny' : ''}
                        {row.value.isAlpha ? ' · alpha' : ''}
                      </Text>
                    ) : null}
                  </Table.Td>
                  <Table.Td>
                    {row.ok ? (
                      <Badge color="green">OK</Badge>
                    ) : (
                      <Stack gap={2} data-testid="bulk-import-row-error">
                        {row.errors.map((e, j) => (
                          <Badge key={j} color="red">
                            {e.field}: {e.message}
                          </Badge>
                        ))}
                        {row.suggestion && (
                          <Text size="xs" c="dimmed">
                            Did you mean {row.suggestion}?
                          </Text>
                        )}
                      </Stack>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            data-testid="bulk-import-commit"
            disabled={!allValid}
            onClick={handleCommit}
          >
            {allValid ? `Add ${result!.rows.length} Pokémon` : 'Add Pokémon'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
```

Note: add `Modal` to the import from `@mantine/core` (it is referenced above):

```tsx
import {
  Alert,
  Badge,
  Button,
  FileButton,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  Textarea,
} from '@mantine/core';
```

- [ ] **Step 2: Wire the button into the Owned page**

Modify `src/features/owned/OwnedPage.tsx`. Add the import near the other feature imports:

```tsx
import { BulkImportModal } from './bulkImport/BulkImportModal';
```

Add `Button` and `Group` to the existing `@mantine/core` import on that page if not already present. Add bulk-modal state next to the existing `formOpened` state:

```tsx
const [bulkOpened, setBulkOpened] = useState(false);
```

Replace the standalone `<Title order={1} mb="md">Owned Pokémon</Title>` with a title row that carries the button, and render the modal alongside the form:

```tsx
return (
  <>
    <Group justify="space-between" mb="md">
      <Title order={1}>Owned Pokémon</Title>
      <Button data-testid="owned-bulk-add" variant="default" onClick={() => setBulkOpened(true)}>
        Bulk add
      </Button>
    </Group>
    <OwnedPokemonList onAdd={handleAdd} onEdit={handleEdit} onDuplicate={handleDuplicate} />
    <OwnedPokemonForm opened={formOpened} onClose={handleClose} editingId={editingId} duplicateFromId={duplicateFromId} />
    <BulkImportModal opened={bulkOpened} onClose={() => setBulkOpened(false)} />
  </>
);
```

(Confirm `useState`, `Title`, `Group`, `Button` are all imported at the top of the file; add any that are missing.)

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS, no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/owned/bulkImport/BulkImportModal.tsx src/features/owned/OwnedPage.tsx
git commit -m "feat(bulk-import): add bulk import modal and Owned page entry point"
```

---

## Task 5: End-to-end test

**Files:**
- Create: `e2e/owned-bulk-import.spec.ts`

E2E gotchas (worktree): the suite runs against the production build on `PREVIEW_PORT` (default 3001) — `pretest:e2e` rebuilds automatically. If running in a worktree alongside other servers, set a dedicated port, e.g. `PREVIEW_PORT=3011 npm run test:e2e`.

- [ ] **Step 1: Write the e2e spec**

Create `e2e/owned-bulk-import.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

const VALID_CSV = `species,ivs,nature,gender
Bulbasaur,31/31/31/31/31/31,Modest,male
Charmander,31/0/31/31/31/31,Adamant,male`;

const BAD_CSV = `species,ivs
Notapokemon,31/31/31/31/31/31`;

test('bulk import commits a valid CSV to the pool', async ({ page }) => {
  await page.goto('./#/owned');
  await page.getByTestId('owned-bulk-add').click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByTestId('bulk-import-textarea').fill(VALID_CSV);

  const commit = dialog.getByTestId('bulk-import-commit');
  await expect(commit).toBeEnabled();
  await expect(commit).toHaveText(/Add 2 Pokémon/);
  await commit.click();

  // Modal closes; both species appear in the pool.
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Bulbasaur')).toBeVisible();
  await expect(page.getByText('Charmander')).toBeVisible();
});

test('bulk import blocks commit when a row is invalid', async ({ page }) => {
  await page.goto('./#/owned');
  await page.getByTestId('owned-bulk-add').click();

  const dialog = page.getByRole('dialog');
  await dialog.getByTestId('bulk-import-textarea').fill(BAD_CSV);

  await expect(dialog.getByTestId('bulk-import-row-error')).toBeVisible();
  await expect(dialog.getByTestId('bulk-import-commit')).toBeDisabled();
});
```

- [ ] **Step 2: Run the e2e spec**

Run: `PREVIEW_PORT=3011 npm run test:e2e -- owned-bulk-import.spec.ts`
Expected: PASS (2 tests). The `pretest:e2e` build runs first.

- [ ] **Step 3: Commit**

```bash
git add e2e/owned-bulk-import.spec.ts
git commit -m "test(e2e): cover bulk CSV import commit and validation gating"
```

---

## Task 6: Full verification gate

- [ ] **Step 1: Run the full suite**

Run: `npm run test:unit && npm run typecheck && npm run lint && PREVIEW_PORT=3011 npm run test:e2e`
Expected: all green. Distinguish any pre-existing failures from new ones.

- [ ] **Step 2: Final commit (if any lint/format fixups were needed)**

```bash
git add -A
git commit -m "chore(bulk-import): verification fixups"
```

---

## Self-Review

**Spec coverage:**
- Both paste + upload → Task 4 (`Textarea` + `FileButton`). ✓
- Header-based, only species/dexId mandatory, unknown columns ignored → Task 3 (`buildHeaderMap`, header error, `unknownColumns`). ✓
- Delimiter auto-detect (comma/tab) + quoted fields → Task 1. ✓
- dexId preferred over name; fuzzy suggestion, no auto-accept → Task 3 (`validateRow` resolution; `suggest.ts` Task 2). ✓
- Single `/`-separated `ivs` column in hp/atk/def/spa/spd/spe order; out-of-range = error → Task 3 (`parseIvs`, `STAT_ORDER`). ✓
- Defaults (Hardy nature, primary ability, first allowed gender, false/false, []) → Task 3. ✓
- `isHiddenAbility` derived; gender constrained by `allowedGenders`; egg moves `;`-separated against `species.moves`; boolean tokens → Task 3. ✓
- Independent `shiny`/`alpha` → Task 3. ✓
- Preview table with per-row errors + suggestion + ignored-column note → Task 4. ✓
- All-or-nothing commit (disabled until all valid), count in label, success notification → Task 4. ✓
- Out of scope (projects/goals, dedup, scraping, auto-accept) — not implemented. ✓
- Unit tests for `parseCsv` + `validateRows` (+ `suggest`); e2e for the modal flow → Tasks 1-3, 5. ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code. ✓

**Type consistency:** `RowInput = Omit<OwnedPokemon,'id'|'createdAt'>` matches `addOwnedPokemon`'s parameter; `ValidateResult`/`ParsedRow` names are used identically across Tasks 3-4; `STAT_ORDER` order matches the dataset convention. ✓
