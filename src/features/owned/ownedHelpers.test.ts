import { describe, it, expect } from 'vitest';
import {
  emptyIVs,
  countPerfectIVs,
  formatIVs,
  allowedGenders,
  normalAbilities,
  hiddenAbility,
} from './ownedHelpers';
import type { PokemonSpecies } from '../../data/types';

// ---------------------------------------------------------------------------
// Helpers for building minimal PokemonSpecies objects
// ---------------------------------------------------------------------------

function makeSpecies(overrides: Partial<PokemonSpecies>): PokemonSpecies {
  return {
    id: 1,
    name: 'TestMon',
    types: ['normal'],
    spriteUrl: '',
    eggGroups: [],
    genderRate: 1,
    isGenderless: false,
    femaleRatio: 0.5,
    abilities: [],
    moves: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// emptyIVs
// ---------------------------------------------------------------------------

describe('emptyIVs', () => {
  it('returns an object with all six stats at 0', () => {
    const ivs = emptyIVs();
    expect(ivs.hp).toBe(0);
    expect(ivs.atk).toBe(0);
    expect(ivs.def).toBe(0);
    expect(ivs.spa).toBe(0);
    expect(ivs.spd).toBe(0);
    expect(ivs.spe).toBe(0);
  });

  it('returns a fresh object each call (not the same reference)', () => {
    const a = emptyIVs();
    const b = emptyIVs();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// countPerfectIVs
// ---------------------------------------------------------------------------

describe('countPerfectIVs', () => {
  it('returns 0 when no stat is 31', () => {
    expect(countPerfectIVs({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 })).toBe(0);
  });

  it('returns the correct count when some stats are 31', () => {
    expect(countPerfectIVs({ hp: 31, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 })).toBe(2);
    expect(countPerfectIVs({ hp: 31, atk: 0, def: 31, spa: 31, spd: 0, spe: 31 })).toBe(4);
  });

  it('returns 6 when all stats are 31', () => {
    expect(countPerfectIVs({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 })).toBe(6);
  });

  it('does not count stats that are 30 or lower as perfect', () => {
    expect(countPerfectIVs({ hp: 30, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 })).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// formatIVs
// ---------------------------------------------------------------------------

describe('formatIVs', () => {
  it('formats all zeros as "0/0/0/0/0/0"', () => {
    expect(formatIVs({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 })).toBe('0/0/0/0/0/0');
  });

  it('orders stats as hp/atk/def/spa/spd/spe', () => {
    const ivs = { hp: 1, atk: 2, def: 3, spa: 4, spd: 5, spe: 6 };
    expect(formatIVs(ivs)).toBe('1/2/3/4/5/6');
  });

  it('formats all perfect IVs as "31/31/31/31/31/31"', () => {
    expect(formatIVs({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 })).toBe('31/31/31/31/31/31');
  });

  it('formats mixed IVs correctly', () => {
    expect(formatIVs({ hp: 31, atk: 0, def: 15, spa: 31, spd: 0, spe: 31 })).toBe('31/0/15/31/0/31');
  });
});

// ---------------------------------------------------------------------------
// allowedGenders
// ---------------------------------------------------------------------------

describe('allowedGenders', () => {
  it('returns ["genderless"] for a genderless species', () => {
    const species = makeSpecies({ isGenderless: true, genderRate: -1 });
    expect(allowedGenders(species)).toEqual(['genderless']);
  });

  it('returns ["male"] for genderRate 0 (100% male)', () => {
    const species = makeSpecies({ isGenderless: false, genderRate: 0 });
    expect(allowedGenders(species)).toEqual(['male']);
  });

  it('returns ["female"] for genderRate 8 (100% female)', () => {
    const species = makeSpecies({ isGenderless: false, genderRate: 8 });
    expect(allowedGenders(species)).toEqual(['female']);
  });

  it('returns ["male", "female"] for other genderRates', () => {
    expect(allowedGenders(makeSpecies({ isGenderless: false, genderRate: 1 }))).toEqual(['male', 'female']);
    expect(allowedGenders(makeSpecies({ isGenderless: false, genderRate: 4 }))).toEqual(['male', 'female']);
    expect(allowedGenders(makeSpecies({ isGenderless: false, genderRate: 7 }))).toEqual(['male', 'female']);
  });
});

// ---------------------------------------------------------------------------
// normalAbilities / hiddenAbility
// ---------------------------------------------------------------------------

describe('normalAbilities', () => {
  it('returns only non-hidden ability names', () => {
    const species = makeSpecies({
      abilities: [
        { name: 'Overgrow', isHidden: false },
        { name: 'Chlorophyll', isHidden: true },
      ],
    });
    expect(normalAbilities(species)).toEqual(['Overgrow']);
  });

  it('returns all non-hidden abilities when there are multiple', () => {
    const species = makeSpecies({
      abilities: [
        { name: 'Ability A', isHidden: false },
        { name: 'Ability B', isHidden: false },
        { name: 'Hidden A', isHidden: true },
      ],
    });
    expect(normalAbilities(species)).toEqual(['Ability A', 'Ability B']);
  });

  it('returns an empty array if all abilities are hidden', () => {
    const species = makeSpecies({
      abilities: [{ name: 'Hidden', isHidden: true }],
    });
    expect(normalAbilities(species)).toEqual([]);
  });
});

describe('hiddenAbility', () => {
  it('returns the hidden ability name when one exists', () => {
    const species = makeSpecies({
      abilities: [
        { name: 'Overgrow', isHidden: false },
        { name: 'Chlorophyll', isHidden: true },
      ],
    });
    expect(hiddenAbility(species)).toBe('Chlorophyll');
  });

  it('returns undefined when no hidden ability exists', () => {
    const species = makeSpecies({
      abilities: [{ name: 'Overgrow', isHidden: false }],
    });
    expect(hiddenAbility(species)).toBeUndefined();
  });

  it('returns undefined when abilities array is empty', () => {
    const species = makeSpecies({ abilities: [] });
    expect(hiddenAbility(species)).toBeUndefined();
  });
});
