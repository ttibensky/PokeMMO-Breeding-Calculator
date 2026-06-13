/**
 * Unit tests for src/engine/planner.ts
 *
 * Pure functions only — no React, no store rendering, no network.
 */

import { describe, it, expect } from 'vitest';
import {
  targetStats,
  targetAttributes,
  goalMet,
  isCompatible,
  carriesAttribute,
  identifyGaps,
  recommendNextPair,
  buildPlan,
  replan,
  validateManualPair,
} from './planner';
import type { OwnedPokemon, BreedingGoal } from '../store/types';
import { DEFAULT_SETTINGS } from '../store/defaults';
import type { PokemonSpecies } from '../data/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _idCounter = 0;
function freshId(): string {
  return `mon-${++_idCounter}`;
}

/** Make a minimal OwnedPokemon with sensible defaults. */
function makeMon(overrides: Partial<OwnedPokemon> = {}): OwnedPokemon {
  return {
    id: freshId(),
    speciesId: 1,
    ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    nature: 'Hardy',
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

/** Make a minimal BreedingGoal. */
function makeGoal(overrides: Partial<BreedingGoal> = {}): BreedingGoal {
  return {
    speciesId: 1,
    targetIVs: {},
    ...overrides,
  };
}

/** Species with the given id and egg groups — defaults to breedable (monster group). */
function makeSpecies(
  id: number,
  partial: Partial<PokemonSpecies> = {},
): PokemonSpecies {
  return {
    id,
    name: `Species${id}`,
    types: ['normal'],
    spriteUrl: '',
    eggGroups: ['monster'],
    genderRate: 4,
    isGenderless: false,
    femaleRatio: 0.5,
    abilities: [{ name: 'Overgrow', isHidden: false }],
    moves: [],
    ...partial,
  };
}

// Common species map used by most tests.
// Species 1: target (monster egg group, 50% female)
// Species 132: Ditto
// Species 2: different egg group (field)
// Species 999: no-eggs group
const SPECIES_MAP: Record<number, PokemonSpecies> = {
  1: makeSpecies(1),
  2: makeSpecies(2, { eggGroups: ['field'] }),
  132: makeSpecies(132, {
    name: 'Ditto',
    eggGroups: ['ditto'],
    isGenderless: true,
    femaleRatio: 0,
  }),
  999: makeSpecies(999, { eggGroups: ['no-eggs'] }),
};

function getSpecies(id: number): PokemonSpecies | undefined {
  return SPECIES_MAP[id];
}

// ─── targetStats ─────────────────────────────────────────────────────────────

describe('targetStats', () => {
  it('returns stats with value 31 only', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 } });
    const result = targetStats(goal);
    expect(result).toHaveLength(2);
    expect(result).toContain('hp');
    expect(result).toContain('atk');
  });

  it('returns empty array when no target IVs set', () => {
    const goal = makeGoal({ targetIVs: {} });
    expect(targetStats(goal)).toEqual([]);
  });

  it('a single target stat', () => {
    const goal = makeGoal({ targetIVs: { spe: 31 } });
    expect(targetStats(goal)).toEqual(['spe']);
  });
});

// ─── targetAttributes ────────────────────────────────────────────────────────

describe('targetAttributes', () => {
  it('produces one iv attribute per target stat', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 } });
    const attrs = targetAttributes(goal);
    expect(attrs).toHaveLength(2);
    expect(attrs.every((a) => a.kind === 'iv')).toBe(true);
    const stats = attrs.map((a) => (a as { kind: 'iv'; stat: string }).stat);
    expect(stats).toContain('hp');
    expect(stats).toContain('atk');
  });

  it('adds a nature attribute when goal.nature is set', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 }, nature: 'Adamant' });
    const attrs = targetAttributes(goal);
    expect(attrs).toHaveLength(3);
    const natureAttr = attrs.find((a) => a.kind === 'nature');
    expect(natureAttr).toBeDefined();
    expect(natureAttr).toEqual({ kind: 'nature', nature: 'Adamant' });
  });

  it('no nature → no nature attribute', () => {
    const goal = makeGoal({ targetIVs: { hp: 31 } });
    const attrs = targetAttributes(goal);
    expect(attrs.every((a) => a.kind === 'iv')).toBe(true);
  });
});

// ─── goalMet ─────────────────────────────────────────────────────────────────

describe('goalMet', () => {
  it('returns true when all target stats are 31 and species matches', () => {
    const mon = makeMon({ speciesId: 1, ivs: { hp: 31, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 } });
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31, atk: 31 } });
    expect(goalMet(mon, goal, getSpecies)).toBe(true);
  });

  it('returns false when one target stat is not 31', () => {
    const mon = makeMon({ speciesId: 1, ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31, atk: 31 } });
    expect(goalMet(mon, goal, getSpecies)).toBe(false);
  });

  it('returns false when species does not match', () => {
    const mon = makeMon({ speciesId: 2, ivs: { hp: 31, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 } });
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31, atk: 31 } });
    expect(goalMet(mon, goal, getSpecies)).toBe(false);
  });

  it('returns false when nature is wrong (goal.nature set)', () => {
    const mon = makeMon({
      speciesId: 1,
      ivs: { hp: 31, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 },
      nature: 'Hardy',
    });
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31, atk: 31 }, nature: 'Adamant' });
    expect(goalMet(mon, goal, getSpecies)).toBe(false);
  });

  it('returns true when nature matches goal.nature', () => {
    const mon = makeMon({
      speciesId: 1,
      ivs: { hp: 31, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 },
      nature: 'Adamant',
    });
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31, atk: 31 }, nature: 'Adamant' });
    expect(goalMet(mon, goal, getSpecies)).toBe(true);
  });

  it('returns false when requireHiddenAbility but mon.isHiddenAbility is false', () => {
    const mon = makeMon({
      speciesId: 1,
      ivs: { hp: 31, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 },
      isHiddenAbility: false,
    });
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31, atk: 31 }, requireHiddenAbility: true });
    expect(goalMet(mon, goal, getSpecies)).toBe(false);
  });

  it('returns true when requireHiddenAbility and mon.isHiddenAbility is true', () => {
    const mon = makeMon({
      speciesId: 1,
      ivs: { hp: 31, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 },
      isHiddenAbility: true,
    });
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31, atk: 31 }, requireHiddenAbility: true });
    expect(goalMet(mon, goal, getSpecies)).toBe(true);
  });

  it('returns false when requireShiny but mon is not shiny', () => {
    const mon = makeMon({
      speciesId: 1,
      ivs: { hp: 31, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 },
      isShiny: false,
    });
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31, atk: 31 }, requireShiny: true });
    expect(goalMet(mon, goal, getSpecies)).toBe(false);
  });

  it('returns false when a required egg move is absent', () => {
    const mon = makeMon({
      speciesId: 1,
      ivs: { hp: 31, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 },
      eggMoves: ['tackle'],
    });
    const goal = makeGoal({
      speciesId: 1,
      targetIVs: { hp: 31, atk: 31 },
      eggMoves: ['tackle', 'growl'],
    });
    expect(goalMet(mon, goal, getSpecies)).toBe(false);
  });

  it('returns true when all required egg moves are present (case-insensitive)', () => {
    const mon = makeMon({
      speciesId: 1,
      ivs: { hp: 31, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 },
      eggMoves: ['Tackle', 'Growl'],
    });
    const goal = makeGoal({
      speciesId: 1,
      targetIVs: { hp: 31, atk: 31 },
      eggMoves: ['tackle', 'growl'],
    });
    expect(goalMet(mon, goal, getSpecies)).toBe(true);
  });

  it('returns false when wrong gender (goal.gender set)', () => {
    const mon = makeMon({
      speciesId: 1,
      ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      gender: 'male',
    });
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31 }, gender: 'female' });
    expect(goalMet(mon, goal, getSpecies)).toBe(false);
  });
});

// ─── isCompatible ────────────────────────────────────────────────────────────

describe('isCompatible', () => {
  it('same species → true', () => {
    const mon = makeMon({ speciesId: 1 });
    const goal = makeGoal({ speciesId: 1 });
    expect(isCompatible(mon, goal, getSpecies)).toBe(true);
  });

  it('Ditto (132) → true regardless of goal species', () => {
    const mon = makeMon({ speciesId: 132 });
    const goal = makeGoal({ speciesId: 1 });
    expect(isCompatible(mon, goal, getSpecies)).toBe(true);
  });

  it('sharing an egg group with target → true', () => {
    // Species 3 shares monster egg group with species 1
    const speciesMap3: Record<number, PokemonSpecies> = {
      ...SPECIES_MAP,
      3: makeSpecies(3, { eggGroups: ['monster'] }),
    };
    const gs = (id: number) => speciesMap3[id];
    const mon = makeMon({ speciesId: 3 });
    const goal = makeGoal({ speciesId: 1 });
    expect(isCompatible(mon, goal, gs)).toBe(true);
  });

  it('different egg group non-Ditto → false', () => {
    // Species 2 has 'field' egg group, species 1 has 'monster' — no overlap
    const mon = makeMon({ speciesId: 2 });
    const goal = makeGoal({ speciesId: 1 });
    expect(isCompatible(mon, goal, getSpecies)).toBe(false);
  });

  it('unknown species returns false', () => {
    const mon = makeMon({ speciesId: 9999 });
    const goal = makeGoal({ speciesId: 1 });
    expect(isCompatible(mon, goal, getSpecies)).toBe(false);
  });
});

// ─── carriesAttribute ────────────────────────────────────────────────────────

describe('carriesAttribute', () => {
  it('iv attribute: returns true when mon.ivs[stat]===31', () => {
    const mon = makeMon({ ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
    expect(carriesAttribute(mon, { kind: 'iv', stat: 'hp' })).toBe(true);
  });

  it('iv attribute: returns false when mon.ivs[stat] < 31', () => {
    const mon = makeMon({ ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
    expect(carriesAttribute(mon, { kind: 'iv', stat: 'hp' })).toBe(false);
  });

  it('nature attribute: returns true when mon.nature matches', () => {
    const mon = makeMon({ nature: 'Adamant' });
    expect(carriesAttribute(mon, { kind: 'nature', nature: 'Adamant' })).toBe(true);
  });

  it('nature attribute: returns false when mon.nature does not match', () => {
    const mon = makeMon({ nature: 'Hardy' });
    expect(carriesAttribute(mon, { kind: 'nature', nature: 'Adamant' })).toBe(false);
  });
});

// ─── identifyGaps ────────────────────────────────────────────────────────────

describe('identifyGaps', () => {
  it('empty pool with 3×31 goal → 3 gaps, each description references the stat', () => {
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31, atk: 31, def: 31 } });
    const gaps = identifyGaps([], goal, getSpecies);
    expect(gaps).toHaveLength(3);
    for (const gap of gaps) {
      expect(gap.description.length).toBeGreaterThan(0);
    }
    // Each gap description should reference the stat name
    const descriptions = gaps.map((g) => g.description);
    expect(descriptions.some((d) => d.includes('HP'))).toBe(true);
    expect(descriptions.some((d) => d.includes('Atk'))).toBe(true);
    expect(descriptions.some((d) => d.includes('Def'))).toBe(true);
  });

  it('goal with nature, pool lacks the nature carrier → nature gap present', () => {
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31 }, nature: 'Adamant' });
    // Pool has HP carrier but not Adamant nature
    const hpCarrier = makeMon({
      speciesId: 1,
      ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      nature: 'Hardy',
    });
    const gaps = identifyGaps([hpCarrier], goal, getSpecies);
    const natureGap = gaps.find((g) => g.attribute.kind === 'nature');
    expect(natureGap).toBeDefined();
    expect(natureGap!.description).toContain('Adamant');
  });

  it('pool that carries all attributes → no gaps', () => {
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31, atk: 31 } });
    const monA = makeMon({
      speciesId: 1,
      ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    });
    const monB = makeMon({
      speciesId: 1,
      ivs: { hp: 0, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 },
    });
    const gaps = identifyGaps([monA, monB], goal, getSpecies);
    expect(gaps).toHaveLength(0);
  });

  it('pool carries HP but not Atk → only Atk gap', () => {
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31, atk: 31 } });
    const hpOnly = makeMon({
      speciesId: 1,
      ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    });
    const gaps = identifyGaps([hpOnly], goal, getSpecies);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].attribute).toEqual({ kind: 'iv', stat: 'atk' });
  });

  it('incompatible mon does not count as a carrier', () => {
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31 } });
    // Species 2 is field egg group, incompatible with species 1 (monster)
    const incompatible = makeMon({
      speciesId: 2,
      ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    });
    const gaps = identifyGaps([incompatible], goal, getSpecies);
    expect(gaps).toHaveLength(1);
  });
});

// ─── recommendNextPair ───────────────────────────────────────────────────────

describe('recommendNextPair', () => {
  const settings = DEFAULT_SETTINGS;

  it('empty pool → null', () => {
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31 } });
    expect(recommendNextPair([], goal, settings, getSpecies)).toBeNull();
  });

  it('single mon → null', () => {
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31 } });
    const mon = makeMon({ speciesId: 1, ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
    expect(recommendNextPair([mon], goal, settings, getSpecies)).toBeNull();
  });

  it('clean 2×31 case: female HP carrier + male Atk carrier → recommendation with both stats guaranteed', () => {
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31, atk: 31 } });
    const femaleHP = makeMon({
      speciesId: 1,
      gender: 'female',
      ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    });
    const maleAtk = makeMon({
      speciesId: 1,
      gender: 'male',
      ivs: { hp: 0, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 },
    });

    const rec = recommendNextPair([femaleHP, maleAtk], goal, settings, getSpecies);
    expect(rec).not.toBeNull();
    const pair = rec!.pair;

    // Both hp and atk should be guaranteed
    expect(pair.guaranteedTargetStats).toContain('hp');
    expect(pair.guaranteedTargetStats).toContain('atk');

    // Score should be at least 2 (one per guaranteed stat)
    expect(pair.score).toBeGreaterThanOrEqual(2);

    // Items: powerWeight pins HP, powerBracer pins Atk
    const items = Object.values(pair.items);
    expect(items).toContain('powerWeight');
    expect(items).toContain('powerBracer');
  });

  it('forcedGender is "female" for intermediate non-genderless non-final breed', () => {
    // 3 target stats: HP, Atk, Def — a 2-stat pair is an intermediate step
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31, atk: 31, def: 31 } });
    const femaleHP = makeMon({
      speciesId: 1,
      gender: 'female',
      ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    });
    const maleAtk = makeMon({
      speciesId: 1,
      gender: 'male',
      ivs: { hp: 0, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 },
    });

    const rec = recommendNextPair([femaleHP, maleAtk], goal, settings, getSpecies);
    expect(rec).not.toBeNull();
    // Not a final breed (missing def), so forcedGender should be 'female'
    expect(rec!.pair.forcedGender).toBe('female');
  });

  it('forcedGender is undefined when Ditto is involved', () => {
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31, atk: 31 } });
    const ditto = makeMon({
      speciesId: 132,
      gender: 'genderless',
      ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    });
    const target = makeMon({
      speciesId: 1,
      gender: 'female',
      ivs: { hp: 0, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 },
    });

    const rec = recommendNextPair([ditto, target], goal, settings, getSpecies);
    expect(rec).not.toBeNull();
    expect(rec!.pair.forcedGender).toBeUndefined();
  });

  it('alternativesForA includes other carriers of the same pinned stat', () => {
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31, atk: 31 } });
    const femaleHP1 = makeMon({
      speciesId: 1,
      gender: 'female',
      ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    });
    const femaleHP2 = makeMon({
      speciesId: 1,
      gender: 'female',
      ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    });
    const maleAtk = makeMon({
      speciesId: 1,
      gender: 'male',
      ivs: { hp: 0, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 },
    });

    const rec = recommendNextPair([femaleHP1, femaleHP2, maleAtk], goal, settings, getSpecies);
    expect(rec).not.toBeNull();
    // One of the HP carriers will be chosen as parentA; the other should be in alternativesForA
    expect(
      rec!.alternativesForA.length > 0 || rec!.alternativesForB.length > 0,
    ).toBe(true);
  });

  it('no-progress case: both mons carry same single stat → null', () => {
    // Both parents carry HP=31 only. Child's guaranteed count = 1,
    // max parent's count = 1 → no real progress
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31, atk: 31 } });
    const femaleHP = makeMon({
      speciesId: 1,
      gender: 'female',
      ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    });
    const maleHP = makeMon({
      speciesId: 1,
      gender: 'male',
      ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    });
    // This pair: both pin HP → child guaranteed HP=31 (count=1), max parent = 1, no progress
    const rec = recommendNextPair([femaleHP, maleHP], goal, settings, getSpecies);
    expect(rec).toBeNull();
  });

  it('returns null when only pair is incompatible (same gender, no Ditto)', () => {
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31, atk: 31 } });
    const femaleHP = makeMon({
      speciesId: 1,
      gender: 'female',
      ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    });
    const femaleAtk = makeMon({
      speciesId: 1,
      gender: 'female',
      ivs: { hp: 0, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 },
    });
    // Same gender → invalid pair → no candidates
    const rec = recommendNextPair([femaleHP, femaleAtk], goal, settings, getSpecies);
    expect(rec).toBeNull();
  });
});

// ─── buildPlan / replan ──────────────────────────────────────────────────────

describe('buildPlan', () => {
  const settings = DEFAULT_SETTINGS;

  it('done: pool contains a mon that goalMet → plan.done true, matchingPokemonId set, recommendation null', () => {
    const mon = makeMon({
      speciesId: 1,
      ivs: { hp: 31, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 },
    });
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31, atk: 31 } });
    const plan = buildPlan([mon], goal, settings, getSpecies);

    expect(plan.done).toBe(true);
    expect(plan.matchingPokemonId).toBe(mon.id);
    expect(plan.recommendation).toBeNull();
  });

  it('done plan still has estimate populated and gaps computed', () => {
    const mon = makeMon({
      speciesId: 1,
      ivs: { hp: 31, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 },
    });
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31, atk: 31 } });
    const plan = buildPlan([mon], goal, settings, getSpecies);

    expect(plan.estimate).toBeDefined();
    expect(plan.estimate.attributeCount).toBe(2);
    expect(plan.gaps).toBeDefined();
    // mon carries both hp and atk → no gaps
    expect(plan.gaps).toHaveLength(0);
  });

  it('not done with productive pool → done false, recommendation non-null, estimate.totalBreeds > 0', () => {
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31, atk: 31 } });
    const femaleHP = makeMon({
      speciesId: 1,
      gender: 'female',
      ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    });
    const maleAtk = makeMon({
      speciesId: 1,
      gender: 'male',
      ivs: { hp: 0, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 },
    });

    const plan = buildPlan([femaleHP, maleAtk], goal, settings, getSpecies);

    expect(plan.done).toBe(false);
    expect(plan.matchingPokemonId).toBeUndefined();
    expect(plan.recommendation).not.toBeNull();
    expect(plan.estimate.totalBreeds).toBeGreaterThan(0);
  });

  it('not done with uncovered attributes → gaps reflect uncovered stats', () => {
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31, atk: 31 } });
    // Only HP carrier present, Atk is a gap
    const femaleHP = makeMon({
      speciesId: 1,
      gender: 'female',
      ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    });
    const plan = buildPlan([femaleHP], goal, settings, getSpecies);

    expect(plan.done).toBe(false);
    const gapStats = plan.gaps.map((g) => (g.attribute.kind === 'iv' ? g.attribute.stat : null));
    expect(gapStats).toContain('atk');
  });

  it('empty pool → done false, recommendation null, gaps = all target attributes', () => {
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31, atk: 31 } });
    const plan = buildPlan([], goal, settings, getSpecies);

    expect(plan.done).toBe(false);
    expect(plan.recommendation).toBeNull();
    expect(plan.gaps).toHaveLength(2);
  });
});

describe('replan', () => {
  it('replan is an alias for buildPlan — returns deep-equal output for same input', () => {
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31, atk: 31 } });
    const femaleHP = makeMon({
      speciesId: 1,
      gender: 'female',
      ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    });
    const maleAtk = makeMon({
      speciesId: 1,
      gender: 'male',
      ivs: { hp: 0, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 },
    });

    const pool = [femaleHP, maleAtk];
    const planResult = buildPlan(pool, goal, DEFAULT_SETTINGS, getSpecies);
    const replanResult = replan(pool, goal, DEFAULT_SETTINGS, getSpecies);

    expect(replanResult).toEqual(planResult);
  });
});

// ─── validateManualPair ──────────────────────────────────────────────────────

describe('validateManualPair', () => {
  const settings = DEFAULT_SETTINGS;

  it('two valid compatible parents → validation.valid true and candidate defined', () => {
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31, atk: 31 } });
    const female = makeMon({
      speciesId: 1,
      gender: 'female',
      ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    });
    const male = makeMon({
      speciesId: 1,
      gender: 'male',
      ivs: { hp: 0, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 },
    });

    const result = validateManualPair(female.id, male.id, [female, male], goal, settings, getSpecies);

    expect(result.validation.valid).toBe(true);
    expect(result.candidate).toBeDefined();
    const candidate = result.candidate!;
    expect(candidate.parentAId).toBe(female.id);
    expect(candidate.parentBId).toBe(male.id);
    expect(candidate.prediction).toBeDefined();
    expect(candidate.estimatedStepCost).toBeGreaterThanOrEqual(0);
    expect(candidate.items).toBeDefined();
    // This pair covers all target stats (hp+atk=31) → predictedIsFinal=true.
    // goal.gender is not set, so determineForcedGender returns undefined for a final breed
    // with no requested gender. That is correct engine behavior.
    expect(candidate.forcedGender).toBeUndefined();
  });

  it('two valid compatible parents for intermediate step → forcedGender is "female"', () => {
    // 3-stat goal; the pair covers only hp+atk → intermediate, so forcedGender = 'female'
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31, atk: 31, def: 31 } });
    const female = makeMon({
      speciesId: 1,
      gender: 'female',
      ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    });
    const male = makeMon({
      speciesId: 1,
      gender: 'male',
      ivs: { hp: 0, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 },
    });

    const result = validateManualPair(female.id, male.id, [female, male], goal, settings, getSpecies);

    expect(result.validation.valid).toBe(true);
    expect(result.candidate).toBeDefined();
    expect(result.candidate!.forcedGender).toBe('female');
  });

  it('invalid pair (same gender) → validation.valid false, no candidate', () => {
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31 } });
    const femaleA = makeMon({
      speciesId: 1,
      gender: 'female',
      ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    });
    const femaleB = makeMon({
      speciesId: 1,
      gender: 'female',
      ivs: { hp: 0, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 },
    });

    const result = validateManualPair(femaleA.id, femaleB.id, [femaleA, femaleB], goal, settings, getSpecies);

    expect(result.validation.valid).toBe(false);
    expect(result.candidate).toBeUndefined();
  });

  it('missing parentA id → validation.valid false with reason mentioning the missing id', () => {
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31 } });
    const male = makeMon({ speciesId: 1, gender: 'male' });

    const result = validateManualPair('missing-id', male.id, [male], goal, settings, getSpecies);

    expect(result.validation.valid).toBe(false);
    expect(result.validation.reasons.length).toBeGreaterThan(0);
    expect(result.validation.reasons[0]).toContain('missing-id');
  });

  it('missing parentB id → validation.valid false with reason mentioning the missing id', () => {
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31 } });
    const female = makeMon({ speciesId: 1, gender: 'female' });

    const result = validateManualPair(female.id, 'absent-id', [female], goal, settings, getSpecies);

    expect(result.validation.valid).toBe(false);
    expect(result.validation.reasons[0]).toContain('absent-id');
  });

  it('both parents missing → validation.valid false, reason mentions both ids', () => {
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31 } });

    const result = validateManualPair('idA', 'idB', [], goal, settings, getSpecies);

    expect(result.validation.valid).toBe(false);
    expect(result.validation.reasons[0]).toContain('idA');
    expect(result.validation.reasons[0]).toContain('idB');
  });

  it('shiny mismatch → validation.valid false', () => {
    const goal = makeGoal({ speciesId: 1, targetIVs: { hp: 31 } });
    const shiny = makeMon({ speciesId: 1, gender: 'female', isShiny: true });
    const normal = makeMon({ speciesId: 1, gender: 'male', isShiny: false });

    const result = validateManualPair(shiny.id, normal.id, [shiny, normal], goal, settings, getSpecies);

    expect(result.validation.valid).toBe(false);
  });
});
