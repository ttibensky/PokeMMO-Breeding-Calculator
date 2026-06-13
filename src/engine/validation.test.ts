import { describe, it, expect } from 'vitest';
import { validatePair } from './validation';
import type { OwnedPokemon } from '../store/types';
import type { PokemonSpecies } from '../data/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMon(overrides?: Partial<OwnedPokemon>): OwnedPokemon {
  return {
    id: 'mon-a',
    speciesId: 1,
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    nature: 'Adamant',
    ability: 'Overgrow',
    isHiddenAbility: false,
    gender: 'female',
    isShiny: false,
    isAlpha: false,
    eggMoves: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeSpecies(overrides?: Partial<PokemonSpecies>): PokemonSpecies {
  return {
    id: 1,
    name: 'Bulbasaur',
    types: ['Grass', 'Poison'],
    spriteUrl: '',
    eggGroups: ['monster', 'plant'],
    genderRate: 7,
    isGenderless: false,
    femaleRatio: 0.125,
    abilities: [],
    moves: [],
    ...overrides,
  };
}

const DITTO_SPECIES: PokemonSpecies = makeSpecies({
  id: 132,
  name: 'Ditto',
  eggGroups: ['ditto'],
  isGenderless: true,
  genderRate: -1,
  femaleRatio: 0,
});

/** Build a getSpecies lookup from a map of id -> PokemonSpecies. */
function makeGetSpecies(map: Record<number, PokemonSpecies>) {
  return (id: number): PokemonSpecies | undefined => map[id];
}

// Species used in tests
const BULBASAUR = makeSpecies({ id: 1, name: 'Bulbasaur', eggGroups: ['monster', 'plant'] });
const CHARMANDER = makeSpecies({ id: 4, name: 'Charmander', eggGroups: ['monster', 'dragon'] });
const ODDISH = makeSpecies({ id: 43, name: 'Oddish', eggGroups: ['plant'] });
const MAGNEMITE = makeSpecies({ id: 81, name: 'Magnemite', eggGroups: ['mineral'], isGenderless: true });
const STARYU = makeSpecies({ id: 120, name: 'Staryu', eggGroups: ['water-3'], isGenderless: true });
const SNORLAX = makeSpecies({ id: 143, name: 'Snorlax', eggGroups: ['monster'] });
const NO_EGGS_MON = makeSpecies({ id: 999, name: 'NoEggsMon', eggGroups: ['no-eggs'] });
const WATER_MON = makeSpecies({ id: 7, name: 'Squirtle', eggGroups: ['water-1', 'monster'] });

const DEFAULT_SPECIES_MAP: Record<number, PokemonSpecies> = {
  1: BULBASAUR,
  4: CHARMANDER,
  7: WATER_MON,
  43: ODDISH,
  81: MAGNEMITE,
  120: STARYU,
  132: DITTO_SPECIES,
  143: SNORLAX,
  999: NO_EGGS_MON,
};

const getSpecies = makeGetSpecies(DEFAULT_SPECIES_MAP);

// ---------------------------------------------------------------------------
// validatePair — mechanics §1 and §8
// ---------------------------------------------------------------------------

describe('validatePair — valid pairs', () => {
  it('same egg group, opposite genders → valid, empty reasons', () => {
    const female = makeMon({ id: 'f', speciesId: 1, gender: 'female' });
    const male = makeMon({ id: 'm', speciesId: 143, gender: 'male' });
    const result = validatePair(female, male, getSpecies);
    expect(result.valid).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('offspringSpeciesId equals the female parent species', () => {
    const female = makeMon({ id: 'f', speciesId: 1, gender: 'female' });
    const male = makeMon({ id: 'm', speciesId: 143, gender: 'male' });
    const result = validatePair(female, male, getSpecies);
    expect(result.offspringSpeciesId).toBe(1);
  });

  it('femaleRoleParentId equals the female parent id', () => {
    const female = makeMon({ id: 'f', speciesId: 1, gender: 'female' });
    const male = makeMon({ id: 'm', speciesId: 143, gender: 'male' });
    const result = validatePair(female, male, getSpecies);
    expect(result.femaleRoleParentId).toBe('f');
  });

  it('both shiny, opposite gender, same egg group → valid', () => {
    const female = makeMon({ id: 'f', speciesId: 1, gender: 'female', isShiny: true });
    const male = makeMon({ id: 'm', speciesId: 143, gender: 'male', isShiny: true });
    const result = validatePair(female, male, getSpecies);
    expect(result.valid).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('Ditto + gendered mon → valid regardless of egg group', () => {
    // Oddish is in 'plant'; Ditto is in 'ditto' — no shared group
    const ditto = makeMon({ id: 'ditto', speciesId: 132, gender: 'genderless' });
    const oddish = makeMon({ id: 'odd', speciesId: 43, gender: 'female' });
    const result = validatePair(ditto, oddish, getSpecies);
    expect(result.valid).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('Ditto + gendered mon → offspringSpeciesId = non-Ditto species', () => {
    const ditto = makeMon({ id: 'ditto', speciesId: 132, gender: 'genderless' });
    const oddish = makeMon({ id: 'odd', speciesId: 43, gender: 'female' });
    const result = validatePair(ditto, oddish, getSpecies);
    expect(result.offspringSpeciesId).toBe(43);
  });

  it('Ditto + gendered mon → femaleRoleParentId = non-Ditto id', () => {
    const ditto = makeMon({ id: 'ditto', speciesId: 132, gender: 'genderless' });
    const oddish = makeMon({ id: 'odd', speciesId: 43, gender: 'female' });
    const result = validatePair(ditto, oddish, getSpecies);
    expect(result.femaleRoleParentId).toBe('odd');
  });

  it('Ditto + male gendered mon (any gender) → valid', () => {
    const ditto = makeMon({ id: 'ditto', speciesId: 132, gender: 'genderless' });
    const bulba = makeMon({ id: 'b', speciesId: 1, gender: 'male' });
    const result = validatePair(ditto, bulba, getSpecies);
    expect(result.valid).toBe(true);
  });

  it('genderless non-Ditto + Ditto → valid; offspring = genderless species', () => {
    const magnemite = makeMon({ id: 'mag', speciesId: 81, gender: 'genderless' });
    const ditto = makeMon({ id: 'ditto', speciesId: 132, gender: 'genderless' });
    const result = validatePair(magnemite, ditto, getSpecies);
    expect(result.valid).toBe(true);
    expect(result.offspringSpeciesId).toBe(81);
  });
});

describe('validatePair — invalid pairs', () => {
  it('both male, same egg group → invalid with gender reason', () => {
    const maleA = makeMon({ id: 'a', speciesId: 1, gender: 'male' });
    const maleB = makeMon({ id: 'b', speciesId: 143, gender: 'male' });
    const result = validatePair(maleA, maleB, getSpecies);
    expect(result.valid).toBe(false);
    const genderReason = result.reasons.find((r) => r.toLowerCase().includes('male'));
    expect(genderReason).toBeDefined();
  });

  it('opposite gender, no shared egg group, neither Ditto → invalid with egg-group reason', () => {
    // Oddish (plant), Charmander (monster, dragon) — no 'plant' in Charmander
    const female = makeMon({ id: 'f', speciesId: 43, gender: 'female' });
    const male = makeMon({ id: 'm', speciesId: 4, gender: 'male' });
    const result = validatePair(female, male, getSpecies);
    expect(result.valid).toBe(false);
    const eggGroupReason = result.reasons.find((r) => r.toLowerCase().includes('egg group'));
    expect(eggGroupReason).toBeDefined();
  });

  it('two Dittos → invalid', () => {
    const dittoA = makeMon({ id: 'da', speciesId: 132, gender: 'genderless' });
    const dittoB = makeMon({ id: 'db', speciesId: 132, gender: 'genderless' });
    const result = validatePair(dittoA, dittoB, getSpecies);
    expect(result.valid).toBe(false);
    const reason = result.reasons.find((r) => r.toLowerCase().includes('ditto'));
    expect(reason).toBeDefined();
  });

  it('genderless non-Ditto + normal gendered non-Ditto → invalid', () => {
    const magnemite = makeMon({ id: 'mag', speciesId: 81, gender: 'genderless' });
    const bulba = makeMon({ id: 'b', speciesId: 1, gender: 'female' });
    // Use a species map where they share no groups anyway, but genderless rule fires
    const result = validatePair(magnemite, bulba, getSpecies);
    expect(result.valid).toBe(false);
    const reason = result.reasons.find((r) => r.toLowerCase().includes('genderless'));
    expect(reason).toBeDefined();
  });

  it('shiny + non-shiny (otherwise legal pair) → invalid with shiny reason', () => {
    const female = makeMon({ id: 'f', speciesId: 1, gender: 'female', isShiny: true });
    const male = makeMon({ id: 'm', speciesId: 143, gender: 'male', isShiny: false });
    const result = validatePair(female, male, getSpecies);
    expect(result.valid).toBe(false);
    const reason = result.reasons.find((r) => r.toLowerCase().includes('shiny'));
    expect(reason).toBeDefined();
  });

  it('no-eggs species → invalid with no-eggs reason', () => {
    const noEggs = makeMon({ id: 'ne', speciesId: 999, gender: 'female' });
    const male = makeMon({ id: 'm', speciesId: 143, gender: 'male' });
    const result = validatePair(noEggs, male, getSpecies);
    expect(result.valid).toBe(false);
    const reason = result.reasons.find((r) => r.toLowerCase().includes('no-eggs'));
    expect(reason).toBeDefined();
  });

  it('multiple violations accumulate (same gender + different egg group) → reasons.length >= 2', () => {
    // Oddish (plant) vs Charmander (monster, dragon): no shared group; and both male
    const maleA = makeMon({ id: 'a', speciesId: 43, gender: 'male' });
    const maleB = makeMon({ id: 'b', speciesId: 4, gender: 'male' });
    const result = validatePair(maleA, maleB, getSpecies);
    expect(result.valid).toBe(false);
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
  });
});
