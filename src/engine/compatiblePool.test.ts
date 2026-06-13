import { describe, it, expect } from 'vitest';
import { getCompatibleSpecies } from './compatiblePool';
import type { PokemonSpecies } from '../data/types';

function makeSpecies(overrides?: Partial<PokemonSpecies>): PokemonSpecies {
  return {
    id: 1,
    name: 'Bulbasaur',
    types: ['Grass'],
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

const BULBASAUR = makeSpecies({ id: 1, name: 'Bulbasaur', eggGroups: ['monster', 'plant'] });
const CHARMANDER = makeSpecies({ id: 4, name: 'Charmander', eggGroups: ['monster', 'dragon'] });
const GASTLY = makeSpecies({ id: 92, name: 'Gastly', eggGroups: ['amorphous'] });
const MEWTWO = makeSpecies({ id: 150, name: 'Mewtwo', eggGroups: ['no-eggs'], isGenderless: true });
const MAGNEMITE = makeSpecies({ id: 81, name: 'Magnemite', eggGroups: ['mineral'], isGenderless: true });
const GENDERLESS_MONSTER = makeSpecies({ id: 201, name: 'GenderlessMon', eggGroups: ['monster'], isGenderless: true });
const DITTO = makeSpecies({ id: 132, name: 'Ditto', eggGroups: ['ditto'], isGenderless: true });

const ALL = [BULBASAUR, CHARMANDER, GASTLY, MEWTWO, MAGNEMITE, GENDERLESS_MONSTER, DITTO];
const getSpecies = (id: number) => ALL.find((s) => s.id === id);

describe('getCompatibleSpecies', () => {
  it('includes a gendered species sharing an egg group, with Ditto pinned first', () => {
    const result = getCompatibleSpecies(1, getSpecies, ALL);
    expect(result.map((s) => s.id)).toEqual([132, 4]);
  });

  it('excludes non-sharing, no-eggs, genderless-non-Ditto species, and the target itself', () => {
    const ids = getCompatibleSpecies(1, getSpecies, ALL).map((s) => s.id);
    expect(ids).not.toContain(92); // Gastly: no shared group
    expect(ids).not.toContain(150); // Mewtwo: no-eggs
    expect(ids).not.toContain(201); // genderless non-Ditto, even though it shares 'monster'
    expect(ids).not.toContain(1); // target itself
  });

  it('returns empty for a no-eggs target', () => {
    expect(getCompatibleSpecies(150, getSpecies, ALL)).toEqual([]);
  });

  it('returns Ditto-only for a genderless breedable target', () => {
    expect(getCompatibleSpecies(81, getSpecies, ALL).map((s) => s.id)).toEqual([132]);
  });
});
