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
