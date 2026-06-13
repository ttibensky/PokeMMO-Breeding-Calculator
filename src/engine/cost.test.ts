import { describe, it, expect } from 'vitest';
import {
  scaledGenderFee,
  averagePowerItemPrice,
  estimateGoal,
  computeStepCost,
  actualVsEstimate,
} from './cost';
import { DEFAULT_SETTINGS } from '../store/defaults';
import type { BreedingGoal, OwnedPokemon, Settings, ItemKey } from '../store/types';
import type { PokemonSpecies } from '../data/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSpecies(overrides?: Partial<PokemonSpecies>): PokemonSpecies {
  return {
    id: 1,
    name: 'Bulbasaur',
    types: ['Grass'],
    spriteUrl: '',
    eggGroups: ['Monster'],
    genderRate: 4,
    isGenderless: false,
    femaleRatio: 0.5,
    abilities: [{ name: 'Overgrow', isHidden: false }],
    moves: [],
    ...overrides,
  };
}

function makeGetSpecies(
  map: Record<number, Partial<PokemonSpecies>>,
): (id: number) => PokemonSpecies | undefined {
  return (id: number) => {
    if (id in map) return makeSpecies({ id, ...map[id] });
    return undefined;
  };
}

function makeGoal(overrides?: Partial<BreedingGoal>): BreedingGoal {
  return {
    speciesId: 1,
    targetIVs: {},
    ...overrides,
  };
}

function makeMon(overrides?: Partial<OwnedPokemon>): OwnedPokemon {
  return {
    id: 'mon-1',
    speciesId: 1,
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    nature: 'Adamant',
    ability: 'Overgrow',
    isHiddenAbility: false,
    gender: 'male',
    isShiny: false,
    isAlpha: false,
    eggMoves: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

const D = DEFAULT_SETTINGS;
const getSpecies11 = makeGetSpecies({ 1: { femaleRatio: 0.5, isGenderless: false } });

// ---------------------------------------------------------------------------
// averagePowerItemPrice
// ---------------------------------------------------------------------------

describe('averagePowerItemPrice', () => {
  it('returns 10000 with DEFAULT_SETTINGS (all power items cost 10000)', () => {
    expect(averagePowerItemPrice(D.prices)).toBe(10000);
  });

  it('returns average when power items have different prices', () => {
    const prices = { ...D.prices, powerWeight: 8000, powerBracer: 12000 };
    const avg = averagePowerItemPrice(prices);
    // 8000 + 12000 + 10000*4 = 60000 / 6 = 10000
    expect(avg).toBe(10000);
  });

  it('excludes everstone from the average', () => {
    const prices = { ...D.prices, everstone: 999999 };
    // Everstone should not affect power item average
    expect(averagePowerItemPrice(prices)).toBe(10000);
  });
});

// ---------------------------------------------------------------------------
// scaledGenderFee
// ---------------------------------------------------------------------------

describe('scaledGenderFee', () => {
  it('ratio 0.5 (1:1) → base fee 5000', () => {
    expect(scaledGenderFee(0.5, D.prices)).toBe(5000);
  });

  it('ratio 0.125 (7:1 female minority) → max fee 25000', () => {
    expect(scaledGenderFee(0.125, D.prices)).toBe(25000);
  });

  it('ratio 0.875 (7:1 male minority, symmetric) → max fee 25000', () => {
    expect(scaledGenderFee(0.875, D.prices)).toBe(25000);
  });

  it('ratio 0.25 → strictly between base and max', () => {
    const fee = scaledGenderFee(0.25, D.prices);
    expect(fee).toBeGreaterThan(5000);
    expect(fee).toBeLessThan(25000);
  });

  it('out-of-range ratio 0 (beyond 7:1) clamps to max fee 25000', () => {
    expect(scaledGenderFee(0, D.prices)).toBe(25000);
  });

  it('out-of-range ratio 1 (beyond 7:1 male minority) clamps to max fee 25000', () => {
    expect(scaledGenderFee(1, D.prices)).toBe(25000);
  });

  it('never returns below base fee regardless of ratio', () => {
    for (const ratio of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]) {
      expect(scaledGenderFee(ratio, D.prices)).toBeGreaterThanOrEqual(D.prices.genderFeeBase);
    }
  });

  it('never returns above max fee regardless of ratio', () => {
    for (const ratio of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]) {
      expect(scaledGenderFee(ratio, D.prices)).toBeLessThanOrEqual(D.prices.genderFeeMax);
    }
  });
});

// ---------------------------------------------------------------------------
// estimateGoal — power items (1:1 species, no nature/gender/ability)
// ---------------------------------------------------------------------------

describe('estimateGoal — power items, 1:1 species, no extras', () => {
  // For a 1:1 non-genderless species: powerItems = breeds * 2 * avgPower
  // 2 attrs: breeds=1, powerItems = 1*2*10000 = 20000
  it('2×31 → totalBreeds 1, baseMonsNeeded 2, powerItems 20000, total 20000', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 } });
    const result = estimateGoal(goal, D, getSpecies11);
    expect(result.totalBreeds).toBe(1);
    expect(result.baseMonsNeeded).toBe(2);
    expect(result.cost.powerItems).toBe(20000);
    expect(result.cost.everstone).toBe(0);
    expect(result.cost.genderFees).toBe(0);
    expect(result.cost.ditto).toBe(0);
    expect(result.cost.total).toBe(20000);
  });

  // 3 attrs: breeds=3, powerItems = 3*2*10000 = 60000
  it('3×31 → breeds 3, powerItems 60000, total 60000', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31, def: 31 } });
    const result = estimateGoal(goal, D, getSpecies11);
    expect(result.totalBreeds).toBe(3);
    expect(result.cost.powerItems).toBe(60000);
    expect(result.cost.total).toBe(60000);
  });

  // 4 attrs: breeds=7, powerItems = 7*2*10000 = 140000
  it('4×31 → breeds 7, powerItems 140000, total 140000', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31, def: 31, spa: 31 } });
    const result = estimateGoal(goal, D, getSpecies11);
    expect(result.totalBreeds).toBe(7);
    expect(result.cost.powerItems).toBe(140000);
    expect(result.cost.total).toBe(140000);
  });

  // 5 attrs: breeds=15, powerItems = 15*2*10000 = 300000
  it('5×31 → breeds 15, powerItems 300000, total 300000', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31 } });
    const result = estimateGoal(goal, D, getSpecies11);
    expect(result.totalBreeds).toBe(15);
    expect(result.cost.powerItems).toBe(300000);
    expect(result.cost.total).toBe(300000);
  });

  // 6 attrs: breeds=31, powerItems = 31*2*10000 = 620000
  it('6×31 → breeds 31, powerItems 620000, total 620000', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 } });
    const result = estimateGoal(goal, D, getSpecies11);
    expect(result.totalBreeds).toBe(31);
    expect(result.cost.powerItems).toBe(620000);
    expect(result.cost.total).toBe(620000);
  });
});

// ---------------------------------------------------------------------------
// estimateGoal — nature (everstone consumed)
// ---------------------------------------------------------------------------

describe('estimateGoal — nature with everstoneConsumed=true', () => {
  // 5×31 + nature → attrs=6, breeds=31, powerItems=620000
  // everstoneCount = attrs-1 = 5, everstone = 5*15000 = 75000
  it('5×31 + nature → attributeCount 6, breeds 31, powerItems 620000, everstone 75000, total 695000', () => {
    const goal = makeGoal({
      targetIVs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31 },
      nature: 'Adamant',
    });
    const result = estimateGoal(goal, D, getSpecies11);
    expect(result.attributeCount).toBe(6);
    expect(result.totalBreeds).toBe(31);
    expect(result.cost.powerItems).toBe(620000);
    expect(result.cost.everstone).toBe(75000);
    expect(result.cost.total).toBe(695000);
  });
});

// ---------------------------------------------------------------------------
// estimateGoal — everstone reusable
// ---------------------------------------------------------------------------

describe('estimateGoal — nature with everstoneConsumed=false (reusable)', () => {
  it('2×31 + nature → everstone = 1 * 15000 = 15000', () => {
    const settings: Settings = {
      ...D,
      mechanics: { ...D.mechanics, everstoneConsumed: false },
    };
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 }, nature: 'Jolly' });
    const result = estimateGoal(goal, settings, getSpecies11);
    expect(result.cost.everstone).toBe(15000);
  });

  it('5×31 + nature → everstone = 1 * 15000 = 15000 (only one stone needed)', () => {
    const settings: Settings = {
      ...D,
      mechanics: { ...D.mechanics, everstoneConsumed: false },
    };
    const goal = makeGoal({
      targetIVs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31 },
      nature: 'Timid',
    });
    const result = estimateGoal(goal, settings, getSpecies11);
    expect(result.cost.everstone).toBe(15000);
  });
});

// ---------------------------------------------------------------------------
// estimateGoal — gender fees
// ---------------------------------------------------------------------------

describe('estimateGoal — gender fees', () => {
  const get7to1 = makeGetSpecies({ 1: { femaleRatio: 0.125, isGenderless: false } });

  // 3×31 with 7:1 species, goal.gender set → genderFees = 3 * 25000 = 75000
  it('7:1 species + goal.gender set, 3×31 → genderFees = 3 * 25000 = 75000', () => {
    const goal = makeGoal({
      targetIVs: { hp: 31, atk: 31, def: 31 },
      gender: 'female',
    });
    const result = estimateGoal(goal, D, get7to1);
    expect(result.cost.genderFees).toBe(75000);
  });

  it('7:1 species, no goal.gender → genderFees = 0', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31, def: 31 } });
    const result = estimateGoal(goal, D, get7to1);
    expect(result.cost.genderFees).toBe(0);
  });

  it('1:1 species + goal.gender, 2×31 → genderFees = 1 * 5000 = 5000', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 }, gender: 'male' });
    const result = estimateGoal(goal, D, getSpecies11);
    expect(result.cost.genderFees).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// estimateGoal — genderless species (Ditto per breed)
// ---------------------------------------------------------------------------

describe('estimateGoal — genderless species', () => {
  const getGenderless = makeGetSpecies({ 1: { isGenderless: true, femaleRatio: 0 } });

  it('genderless + 3×31 → ditto = 3 * 30000 = 90000', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31, def: 31 } });
    const result = estimateGoal(goal, D, getGenderless);
    expect(result.cost.ditto).toBe(90000);
  });

  it('genderless → no gender fees even with goal.gender', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 }, gender: 'genderless' });
    const result = estimateGoal(goal, D, getGenderless);
    expect(result.cost.genderFees).toBe(0);
  });

  it('genderless → assumptions array mentions Ditto', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 } });
    const result = estimateGoal(goal, D, getGenderless);
    const dittoAssumption = result.assumptions.some((a) => a.toLowerCase().includes('ditto'));
    expect(dittoAssumption).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// estimateGoal — ability pill
// ---------------------------------------------------------------------------

describe('estimateGoal — ability pill', () => {
  it('goal.ability set + requireHiddenAbility false → abilityPill = 35000', () => {
    const goal = makeGoal({
      targetIVs: { hp: 31, atk: 31 },
      ability: 'Chlorophyll',
      requireHiddenAbility: false,
    });
    const result = estimateGoal(goal, D, getSpecies11);
    expect(result.cost.abilityPill).toBe(35000);
  });

  it('goal.ability set + requireHiddenAbility true → abilityPill = 0', () => {
    const goal = makeGoal({
      targetIVs: { hp: 31, atk: 31 },
      ability: 'Chlorophyll',
      requireHiddenAbility: true,
    });
    const result = estimateGoal(goal, D, getSpecies11);
    expect(result.cost.abilityPill).toBe(0);
  });

  it('no goal.ability → abilityPill = 0', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 } });
    const result = estimateGoal(goal, D, getSpecies11);
    expect(result.cost.abilityPill).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// estimateGoal — assumptions
// ---------------------------------------------------------------------------

describe('estimateGoal — assumptions', () => {
  it('always returns a non-empty assumptions array', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 } });
    const result = estimateGoal(goal, D, getSpecies11);
    expect(Array.isArray(result.assumptions)).toBe(true);
    expect(result.assumptions.length).toBeGreaterThan(0);
  });

  it('nature goal with everstoneConsumed=true adds everstone assumption', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 }, nature: 'Adamant' });
    const result = estimateGoal(goal, D, getSpecies11);
    const hasEver = result.assumptions.some((a) => a.toLowerCase().includes('everstone'));
    expect(hasEver).toBe(true);
  });

  it('gender goal adds gender fee assumption', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 }, gender: 'female' });
    const result = estimateGoal(goal, D, getSpecies11);
    const hasGender = result.assumptions.some((a) => a.toLowerCase().includes('gender'));
    expect(hasGender).toBe(true);
  });

  it('ability pill goal adds ability assumption', () => {
    const goal = makeGoal({
      targetIVs: { hp: 31, atk: 31 },
      ability: 'Chlorophyll',
      requireHiddenAbility: false,
    });
    const result = estimateGoal(goal, D, getSpecies11);
    const hasAbility = result.assumptions.some((a) => a.toLowerCase().includes('ability'));
    expect(hasAbility).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeStepCost
// ---------------------------------------------------------------------------

describe('computeStepCost', () => {
  it('parentA holds powerWeight (10000) + parentB holds everstone (15000) + forcedGender female on 1:1 → 30000', () => {
    const a = makeMon({ id: 'a', speciesId: 1, gender: 'female' });
    const b = makeMon({ id: 'b', speciesId: 1, gender: 'male' });
    const heldItems: { a?: ItemKey; b?: ItemKey } = { a: 'powerWeight', b: 'everstone' };
    const cost = computeStepCost(a, b, heldItems, 'female', D, getSpecies11);
    // powerWeight 10000 + everstone 15000 (consumed) + genderFee 5000 = 30000
    expect(cost).toBe(30000);
  });

  it('one parent is Ditto (speciesId 132) → adds ditto price 30000', () => {
    const a = makeMon({ id: 'a', speciesId: 132, gender: 'genderless' }); // Ditto
    const b = makeMon({ id: 'b', speciesId: 1, gender: 'female' });
    const heldItems: { a?: ItemKey; b?: ItemKey } = { a: 'powerWeight' };
    const cost = computeStepCost(a, b, heldItems, undefined, D, getSpecies11);
    // powerWeight 10000 + ditto 30000 = 40000
    expect(cost).toBe(40000);
  });

  it('no items, no gender, no ditto → 0', () => {
    const a = makeMon({ id: 'a', speciesId: 1 });
    const b = makeMon({ id: 'b', speciesId: 2 });
    const cost = computeStepCost(a, b, {}, undefined, D, getSpecies11);
    expect(cost).toBe(0);
  });

  it('everstone not consumed when everstoneConsumed=false', () => {
    const settings: Settings = {
      ...D,
      mechanics: { ...D.mechanics, everstoneConsumed: false },
    };
    const a = makeMon({ id: 'a', speciesId: 1 });
    const b = makeMon({ id: 'b', speciesId: 1 });
    const heldItems: { a?: ItemKey; b?: ItemKey } = { a: 'everstone' };
    const cost = computeStepCost(a, b, heldItems, undefined, settings, getSpecies11);
    expect(cost).toBe(0);
  });

  it('two power items, one on each parent → sum of both prices', () => {
    const a = makeMon({ id: 'a', speciesId: 1 });
    const b = makeMon({ id: 'b', speciesId: 1 });
    const heldItems: { a?: ItemKey; b?: ItemKey } = { a: 'powerWeight', b: 'powerBracer' };
    const cost = computeStepCost(a, b, heldItems, undefined, D, getSpecies11);
    // 10000 + 10000 = 20000
    expect(cost).toBe(20000);
  });

  it('forcedGender on genderless offspring species → no gender fee', () => {
    const getG = makeGetSpecies({ 1: { isGenderless: true, femaleRatio: 0 } });
    const a = makeMon({ id: 'a', speciesId: 132, gender: 'genderless' }); // Ditto
    const b = makeMon({ id: 'b', speciesId: 1, gender: 'genderless' });
    const cost = computeStepCost(a, b, {}, 'genderless', D, getG);
    // Ditto: 30000, no gender fee for genderless, no power items
    expect(cost).toBe(30000);
  });
});

// ---------------------------------------------------------------------------
// actualVsEstimate
// ---------------------------------------------------------------------------

describe('actualVsEstimate', () => {
  it('[10000, 20000] vs estimate 25000 → {spent:30000, estimate:25000, delta:5000}', () => {
    expect(actualVsEstimate([10000, 20000], 25000)).toEqual({
      spent: 30000,
      estimate: 25000,
      delta: 5000,
    });
  });

  it('empty progress → spent 0, delta = 0 - estimate', () => {
    expect(actualVsEstimate([], 10000)).toEqual({
      spent: 0,
      estimate: 10000,
      delta: -10000,
    });
  });

  it('spent equals estimate → delta 0', () => {
    expect(actualVsEstimate([5000, 5000], 10000)).toEqual({
      spent: 10000,
      estimate: 10000,
      delta: 0,
    });
  });

  it('single entry → spent = that entry, delta = entry - estimate', () => {
    expect(actualVsEstimate([7000], 5000)).toEqual({
      spent: 7000,
      estimate: 5000,
      delta: 2000,
    });
  });

  it('negative delta when under-spent', () => {
    const result = actualVsEstimate([1000], 50000);
    expect(result.delta).toBeLessThan(0);
    expect(result.delta).toBe(1000 - 50000);
  });
});
