import { describe, it, expect } from 'vitest';
import { getCompatibleSpecies, computeCoverage } from './compatiblePool';
import type { PokemonSpecies } from '../data/types';
import type { OwnedPokemon, BreedingGoal } from '../store/types';

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

function makeMon(overrides?: Partial<OwnedPokemon>): OwnedPokemon {
  return {
    id: 'mon',
    speciesId: 1,
    ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    nature: 'Hardy',
    ability: 'Overgrow',
    isHiddenAbility: false,
    gender: 'male',
    isShiny: false,
    isAlpha: false,
    eggMoves: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const GOAL: BreedingGoal = {
  speciesId: 1,
  targetIVs: { hp: 31, atk: 31 },
  nature: 'Adamant',
};

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

describe('computeCoverage', () => {
  it('builds one entry per target IV plus the nature, in order', () => {
    const result = computeCoverage(GOAL, [], getSpecies);
    expect(result.map((c) => c.attribute)).toEqual([
      { kind: 'iv', stat: 'hp' },
      { kind: 'iv', stat: 'atk' },
      { kind: 'nature', nature: 'Adamant' },
    ]);
    expect(result.every((c) => c.isGap)).toBe(true); // no owned mons → all gaps
  });

  it('counts a different-species MALE carrier, but not a different-species FEMALE', () => {
    const male = makeMon({ id: 'm', speciesId: 4, gender: 'male', ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
    const female = makeMon({ id: 'f', speciesId: 4, gender: 'female', ivs: { hp: 0, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 } });
    const result = computeCoverage(GOAL, [male, female], getSpecies);
    const hp = result.find((c) => c.attribute.kind === 'iv' && c.attribute.stat === 'hp')!;
    const atk = result.find((c) => c.attribute.kind === 'iv' && c.attribute.stat === 'atk')!;
    expect(hp.carriers.map((m) => m.id)).toEqual(['m']);
    expect(hp.isGap).toBe(false);
    expect(atk.carriers).toEqual([]); // female of a different species cannot feed the line
    expect(atk.isGap).toBe(true);
  });

  it('counts same-species (any gender), Ditto, and nature matches', () => {
    const sameSpeciesFemale = makeMon({ id: 's', speciesId: 1, gender: 'female', nature: 'Adamant' });
    const ditto = makeMon({ id: 'd', speciesId: 132, gender: 'genderless', ivs: { hp: 0, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 } });
    const result = computeCoverage(GOAL, [sameSpeciesFemale, ditto], getSpecies);
    const atk = result.find((c) => c.attribute.kind === 'iv' && c.attribute.stat === 'atk')!;
    const nature = result.find((c) => c.attribute.kind === 'nature')!;
    expect(atk.carriers.map((m) => m.id)).toEqual(['d']);
    expect(nature.carriers.map((m) => m.id)).toEqual(['s']);
  });

  it('omits the nature entry when the goal sets no nature', () => {
    const result = computeCoverage({ speciesId: 1, targetIVs: { hp: 31 } }, [], getSpecies);
    expect(result.map((c) => c.attribute)).toEqual([{ kind: 'iv', stat: 'hp' }]);
  });

  it('does not count a genderless non-Ditto different-species carrier', () => {
    // speciesId 4 (Charmander) shares 'monster' with Bulbasaur, but gender is genderless,
    // so canContribute returns false and it must not appear as a carrier.
    const genderlessMon = makeMon({ id: 'gl', speciesId: 4, gender: 'genderless', ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
    const result = computeCoverage(GOAL, [genderlessMon], getSpecies);
    const hp = result.find((c) => c.attribute.kind === 'iv' && c.attribute.stat === 'hp')!;
    expect(hp.carriers).toEqual([]);
    expect(hp.isGap).toBe(true);
  });
});
