import { describe, it, expect } from 'vitest';
import {
  countPowerItems,
  statDistribution,
  probabilityPerfect,
  predictOffspring,
} from './inheritance';
import { DEFAULT_SETTINGS } from '../store/defaults';
import type { OwnedPokemon, ItemKey } from '../store/types';
import type { PokemonSpecies } from '../data/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const M = DEFAULT_SETTINGS.mechanics;

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

const BULBASAUR = makeSpecies({ id: 1, eggGroups: ['monster', 'plant'], moves: ['wish', 'tackle'] });
const SNORLAX = makeSpecies({ id: 143, eggGroups: ['monster'], moves: ['tackle'] });
const DITTO_SPECIES = makeSpecies({
  id: 132,
  name: 'Ditto',
  eggGroups: ['ditto'],
  isGenderless: true,
});
const ODDISH = makeSpecies({ id: 43, name: 'Oddish', eggGroups: ['plant'], moves: [] });

function makeGetSpecies(map: Record<number, PokemonSpecies>) {
  return (id: number): PokemonSpecies | undefined => map[id];
}

const getSpecies = makeGetSpecies({
  1: BULBASAUR,
  43: ODDISH,
  132: DITTO_SPECIES,
  143: SNORLAX,
});

// ---------------------------------------------------------------------------
// countPowerItems
// ---------------------------------------------------------------------------

describe('countPowerItems', () => {
  it('empty object → 0', () => {
    expect(countPowerItems({})).toBe(0);
  });

  it('{a: powerWeight} → 1', () => {
    expect(countPowerItems({ a: 'powerWeight' })).toBe(1);
  });

  it('{a: powerWeight, b: powerBracer} → 2', () => {
    expect(countPowerItems({ a: 'powerWeight', b: 'powerBracer' })).toBe(2);
  });

  it('everstone does NOT count: {a: everstone} → 0', () => {
    expect(countPowerItems({ a: 'everstone' })).toBe(0);
  });

  it('everstone on a + power item on b → 1', () => {
    expect(countPowerItems({ a: 'everstone', b: 'powerBelt' })).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// statDistribution — pinned
// ---------------------------------------------------------------------------

describe('statDistribution — pinned', () => {
  it('powerWeight on parent A pins hp → single outcome {value: aIV, p: 1}, pinned: true', () => {
    const dist = statDistribution(31, 10, 'hp', { a: 'powerWeight' }, M);
    expect(dist.pinned).toBe(true);
    expect(dist.outcomes).toHaveLength(1);
    expect(dist.outcomes[0]).toEqual({ value: 31, p: 1 });
  });

  it('powerBracer on parent B pins atk → outcome = bIV', () => {
    const dist = statDistribution(10, 25, 'atk', { b: 'powerBracer' }, M);
    expect(dist.pinned).toBe(true);
    expect(dist.outcomes[0]).toEqual({ value: 25, p: 1 });
  });

  it('parent A takes precedence when both pin same stat', () => {
    // Both holding powerWeight (both pin hp)
    const dist = statDistribution(28, 5, 'hp', { a: 'powerWeight', b: 'powerWeight' }, M);
    expect(dist.pinned).toBe(true);
    expect(dist.outcomes[0].value).toBe(28); // A takes precedence
  });
});

// ---------------------------------------------------------------------------
// statDistribution — not pinned, 2 power items
// ---------------------------------------------------------------------------

describe('statDistribution — not pinned, 2 power items', () => {
  // Items pin hp (powerWeight) and atk (powerBracer); looking at 'def' which is not pinned
  const items: { a: ItemKey; b: ItemKey } = { a: 'powerWeight', b: 'powerBracer' };

  it('aIV=31, bIV=5, stat=def → three outcomes with correct values', () => {
    const dist = statDistribution(31, 5, 'def', items, M);
    expect(dist.pinned).toBe(false);
    const values = dist.outcomes.map((o) => o.value);
    expect(values).toContain(31);           // high
    expect(values).toContain(18);           // avg = floor((31+5)/2)
    expect(values).toContain(5);            // low
  });

  it('aIV=31, bIV=5, stat=def → probabilities 0.125 / 0.75 / 0.125', () => {
    const dist = statDistribution(31, 5, 'def', items, M);
    const byVal: Record<number, number> = {};
    for (const o of dist.outcomes) byVal[o.value] = o.p;
    expect(byVal[31]).toBeCloseTo(0.125);
    expect(byVal[18]).toBeCloseTo(0.75);
    expect(byVal[5]).toBeCloseTo(0.125);
  });

  it('probabilities sum to 1', () => {
    const dist = statDistribution(31, 5, 'def', items, M);
    const sum = dist.outcomes.reduce((acc, o) => acc + o.p, 0);
    expect(sum).toBeCloseTo(1);
  });
});

// ---------------------------------------------------------------------------
// statDistribution — not pinned, 1 power item
// ---------------------------------------------------------------------------

describe('statDistribution — not pinned, 1 power item', () => {
  // powerWeight pins hp; looking at 'def' which is not pinned
  const items: { a: ItemKey } = { a: 'powerWeight' };

  it('aIV=31, bIV=5, stat=def → probabilities 0.2 / 0.6 / 0.2', () => {
    const dist = statDistribution(31, 5, 'def', items, M);
    expect(dist.pinned).toBe(false);
    const byVal: Record<number, number> = {};
    for (const o of dist.outcomes) byVal[o.value] = o.p;
    expect(byVal[31]).toBeCloseTo(0.2);
    expect(byVal[18]).toBeCloseTo(0.6);
    expect(byVal[5]).toBeCloseTo(0.2);
  });

  it('probabilities sum to 1', () => {
    const dist = statDistribution(31, 5, 'def', items, M);
    const sum = dist.outcomes.reduce((acc, o) => acc + o.p, 0);
    expect(sum).toBeCloseTo(1);
  });
});

// ---------------------------------------------------------------------------
// statDistribution — not pinned, 0 power items
// ---------------------------------------------------------------------------

describe('statDistribution — not pinned, 0 power items', () => {
  it('aIV=31, bIV=5, stat=def → probabilities 0.25 / 0.5 / 0.25', () => {
    const dist = statDistribution(31, 5, 'def', {}, M);
    expect(dist.pinned).toBe(false);
    const byVal: Record<number, number> = {};
    for (const o of dist.outcomes) byVal[o.value] = o.p;
    expect(byVal[31]).toBeCloseTo(0.25);
    expect(byVal[18]).toBeCloseTo(0.5);
    expect(byVal[5]).toBeCloseTo(0.25);
  });

  it('probabilities sum to 1', () => {
    const dist = statDistribution(31, 5, 'def', {}, M);
    const sum = dist.outcomes.reduce((acc, o) => acc + o.p, 0);
    expect(sum).toBeCloseTo(1);
  });
});

// ---------------------------------------------------------------------------
// statDistribution — equal IVs and duplicate merging
// ---------------------------------------------------------------------------

describe('statDistribution — equal IVs collapse to single outcome', () => {
  it('aIV === bIV → single outcome, value = aIV, p = 1', () => {
    const dist = statDistribution(31, 31, 'hp', {}, M);
    expect(dist.outcomes).toHaveLength(1);
    expect(dist.outcomes[0]).toEqual({ value: 31, p: 1 });
  });

  it('aIV === bIV = 0 → single outcome, p = 1', () => {
    const dist = statDistribution(0, 0, 'hp', {}, M);
    expect(dist.outcomes).toHaveLength(1);
    expect(dist.outcomes[0]).toEqual({ value: 0, p: 1 });
  });

  it('duplicate values merge so p always sums to 1 (consecutive aIV=1, bIV=0)', () => {
    // avg = floor((1+0)/2) = 0 = low, so 0 appears twice and merges
    const dist = statDistribution(1, 0, 'hp', {}, M);
    const sum = dist.outcomes.reduce((acc, o) => acc + o.p, 0);
    expect(sum).toBeCloseTo(1);
  });

  it('p sums to 1 with 1 power item and consecutive IVs', () => {
    const dist = statDistribution(2, 1, 'def', { a: 'powerWeight' }, M);
    const sum = dist.outcomes.reduce((acc, o) => acc + o.p, 0);
    expect(sum).toBeCloseTo(1);
  });

  it('p sums to 1 with 2 power items and consecutive IVs', () => {
    const dist = statDistribution(2, 1, 'def', { a: 'powerWeight', b: 'powerBracer' }, M);
    const sum = dist.outcomes.reduce((acc, o) => acc + o.p, 0);
    expect(sum).toBeCloseTo(1);
  });
});

// ---------------------------------------------------------------------------
// probabilityPerfect
// ---------------------------------------------------------------------------

describe('probabilityPerfect', () => {
  it('pinned to a 31-IV parent → 1', () => {
    // powerWeight pins hp; aIV = 31
    const p = probabilityPerfect(31, 5, 'hp', { a: 'powerWeight' }, M);
    expect(p).toBe(1);
  });

  it('pinned to a non-31-IV parent → 0', () => {
    const p = probabilityPerfect(20, 31, 'hp', { a: 'powerWeight' }, M);
    expect(p).toBe(0);
  });

  it('both parents 31 (no pin) → 1', () => {
    const p = probabilityPerfect(31, 31, 'hp', {}, M);
    expect(p).toBe(1);
  });

  it('one parent 31, other 0, 2 power items (neither pins this stat) → high probability = 0.125', () => {
    // powerWeight+powerBracer pin hp and atk; checking 'def'
    const p = probabilityPerfect(31, 0, 'def', { a: 'powerWeight', b: 'powerBracer' }, M);
    expect(p).toBeCloseTo(0.125);
  });

  it('target defaults to 31 (explicit target 31 equals no-target)', () => {
    const pDefault = probabilityPerfect(31, 5, 'def', {}, M);
    const pExplicit = probabilityPerfect(31, 5, 'def', {}, M, 31);
    expect(pDefault).toBe(pExplicit);
  });

  it('custom target: probabilityPerfect with target=5 and low=5 → equals low probability', () => {
    // No items, aIV=31, bIV=5 → low=5 with p=0.25
    const p = probabilityPerfect(31, 5, 'def', {}, M, 5);
    expect(p).toBeCloseTo(0.25);
  });
});

// ---------------------------------------------------------------------------
// predictOffspring
// ---------------------------------------------------------------------------

describe('predictOffspring — offspringSpeciesId', () => {
  it('female parent species is offspring species', () => {
    const female = makeMon({ id: 'f', speciesId: 1, gender: 'female' });
    const male = makeMon({ id: 'm', speciesId: 143, gender: 'male' });
    const result = predictOffspring(female, male, {}, M, getSpecies);
    expect(result.offspringSpeciesId).toBe(1);
  });

  it('Ditto pairing → offspring = non-Ditto species', () => {
    const ditto = makeMon({ id: 'ditto', speciesId: 132, gender: 'genderless' });
    const oddish = makeMon({ id: 'odd', speciesId: 43, gender: 'female' });
    const result = predictOffspring(ditto, oddish, {}, M, getSpecies);
    expect(result.offspringSpeciesId).toBe(43);
  });
});

describe('predictOffspring — nature (everstone)', () => {
  it('parent A holds everstone + everstoneGuaranteed true → nature.chance = 1', () => {
    const female = makeMon({ id: 'f', speciesId: 1, gender: 'female', nature: 'Adamant' });
    const male = makeMon({ id: 'm', speciesId: 143, gender: 'male', nature: 'Jolly' });
    const result = predictOffspring(female, male, { a: 'everstone' }, M, getSpecies);
    expect(result.nature).toBeDefined();
    expect(result.nature!.value).toBe('Adamant');
    expect(result.nature!.chance).toBe(1);
  });

  it('parent B holds everstone + everstoneGuaranteed true → nature.value = B nature', () => {
    const female = makeMon({ id: 'f', speciesId: 1, gender: 'female', nature: 'Adamant' });
    const male = makeMon({ id: 'm', speciesId: 143, gender: 'male', nature: 'Jolly' });
    const result = predictOffspring(female, male, { b: 'everstone' }, M, getSpecies);
    expect(result.nature).toBeDefined();
    expect(result.nature!.value).toBe('Jolly');
    expect(result.nature!.chance).toBe(1);
  });

  it('everstoneGuaranteed false → chance = 0.5', () => {
    const female = makeMon({ id: 'f', speciesId: 1, gender: 'female', nature: 'Adamant' });
    const male = makeMon({ id: 'm', speciesId: 143, gender: 'male' });
    const mechanicsNoGuarantee = { ...M, everstoneGuaranteed: false };
    const result = predictOffspring(female, male, { a: 'everstone' }, mechanicsNoGuarantee, getSpecies);
    expect(result.nature).toBeDefined();
    expect(result.nature!.chance).toBe(0.5);
  });

  it('no everstone → nature is undefined', () => {
    const female = makeMon({ id: 'f', speciesId: 1, gender: 'female' });
    const male = makeMon({ id: 'm', speciesId: 143, gender: 'male' });
    const result = predictOffspring(female, male, {}, M, getSpecies);
    expect(result.nature).toBeUndefined();
  });
});

describe('predictOffspring — ability', () => {
  it('female-role parent isHiddenAbility true → ability.isHidden = true, chance = abilityPassRate', () => {
    const female = makeMon({ id: 'f', speciesId: 1, gender: 'female', ability: 'Chlorophyll', isHiddenAbility: true });
    const male = makeMon({ id: 'm', speciesId: 143, gender: 'male', ability: 'Immunity', isHiddenAbility: false });
    const result = predictOffspring(female, male, {}, M, getSpecies);
    expect(result.ability).toBeDefined();
    expect(result.ability!.isHidden).toBe(true);
    expect(result.ability!.chance).toBeCloseTo(M.abilityPassRate); // 0.8
  });

  it('female-role parent normal ability → isHidden false, chance = abilityPassRate', () => {
    const female = makeMon({ id: 'f', speciesId: 1, gender: 'female', ability: 'Overgrow', isHiddenAbility: false });
    const male = makeMon({ id: 'm', speciesId: 143, gender: 'male' });
    const result = predictOffspring(female, male, {}, M, getSpecies);
    expect(result.ability).toBeDefined();
    expect(result.ability!.isHidden).toBe(false);
    expect(result.ability!.chance).toBeCloseTo(0.8);
  });
});

describe('predictOffspring — shiny and alpha', () => {
  it('both shiny → isShiny true', () => {
    const female = makeMon({ id: 'f', speciesId: 1, gender: 'female', isShiny: true });
    const male = makeMon({ id: 'm', speciesId: 143, gender: 'male', isShiny: true });
    const result = predictOffspring(female, male, {}, M, getSpecies);
    expect(result.isShiny).toBe(true);
  });

  it('only one shiny → isShiny false', () => {
    const female = makeMon({ id: 'f', speciesId: 1, gender: 'female', isShiny: true });
    const male = makeMon({ id: 'm', speciesId: 143, gender: 'male', isShiny: false });
    const result = predictOffspring(female, male, {}, M, getSpecies);
    expect(result.isShiny).toBe(false);
  });

  it('both alpha → isAlpha true', () => {
    const female = makeMon({ id: 'f', speciesId: 1, gender: 'female', isAlpha: true });
    const male = makeMon({ id: 'm', speciesId: 143, gender: 'male', isAlpha: true });
    const result = predictOffspring(female, male, {}, M, getSpecies);
    expect(result.isAlpha).toBe(true);
  });

  it('only one alpha → isAlpha false', () => {
    const female = makeMon({ id: 'f', speciesId: 1, gender: 'female', isAlpha: true });
    const male = makeMon({ id: 'm', speciesId: 143, gender: 'male', isAlpha: false });
    const result = predictOffspring(female, male, {}, M, getSpecies);
    expect(result.isAlpha).toBe(false);
  });
});

describe('predictOffspring — possibleEggMoves', () => {
  // BULBASAUR species has moves: ['wish', 'tackle'] (both lowercase in the species data)
  // Implementation lowercases all parent eggMoves and species moves for comparison,
  // then pushes the lowercased form into possibleEggMoves.

  it('parent knows a move learnable by offspring → move included (lowercased)', () => {
    const female = makeMon({ id: 'f', speciesId: 1, gender: 'female', eggMoves: ['Wish'] });
    const male = makeMon({ id: 'm', speciesId: 143, gender: 'male', eggMoves: [] });
    const result = predictOffspring(female, male, {}, M, getSpecies);
    // Implementation stores moves in lowercase
    expect(result.possibleEggMoves).toContain('wish');
  });

  it('parent move NOT learnable by offspring species → excluded', () => {
    // Oddish species has empty moves array, so nothing is learnable
    const female = makeMon({ id: 'f', speciesId: 43, gender: 'female', eggMoves: ['Wish'] });
    const male = makeMon({ id: 'm', speciesId: 43, gender: 'male', eggMoves: ['Wish'] });
    // Same species, different genders, same egg group
    const result = predictOffspring(female, male, {}, M, makeGetSpecies({ 43: ODDISH }));
    expect(result.possibleEggMoves).not.toContain('wish');
    expect(result.possibleEggMoves).toHaveLength(0);
  });

  it('a move neither parent knows → excluded', () => {
    const female = makeMon({ id: 'f', speciesId: 1, gender: 'female', eggMoves: [] });
    const male = makeMon({ id: 'm', speciesId: 143, gender: 'male', eggMoves: [] });
    const result = predictOffspring(female, male, {}, M, getSpecies);
    expect(result.possibleEggMoves).toHaveLength(0);
  });

  it('both parents know different learnable moves → union included', () => {
    // BULBASAUR has moves: ['wish', 'tackle']
    const female = makeMon({ id: 'f', speciesId: 1, gender: 'female', eggMoves: ['Wish'] });
    const male = makeMon({ id: 'm', speciesId: 143, gender: 'male', eggMoves: ['Tackle'] });
    const result = predictOffspring(female, male, {}, M, getSpecies);
    expect(result.possibleEggMoves).toContain('wish');
    expect(result.possibleEggMoves).toContain('tackle');
  });
});

describe('predictOffspring — warnings', () => {
  it('warnings is always an array', () => {
    const female = makeMon({ id: 'f', speciesId: 1, gender: 'female' });
    const male = makeMon({ id: 'm', speciesId: 143, gender: 'male' });
    const result = predictOffspring(female, male, {}, M, getSpecies);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('valid pair → empty warnings', () => {
    const female = makeMon({ id: 'f', speciesId: 1, gender: 'female' });
    const male = makeMon({ id: 'm', speciesId: 143, gender: 'male' });
    const result = predictOffspring(female, male, {}, M, getSpecies);
    expect(result.warnings).toHaveLength(0);
  });
});
