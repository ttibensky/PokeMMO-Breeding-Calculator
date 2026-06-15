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
