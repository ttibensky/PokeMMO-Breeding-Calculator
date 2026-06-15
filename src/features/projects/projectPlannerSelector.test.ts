import { describe, it, expect } from 'vitest';
import { selectPlanner } from './projectPlannerSelector';
import { buildPlan } from '../../engine/planner';
import { DEFAULT_SETTINGS } from '../../store/defaults';
import type { Settings, OwnedPokemon, BreedingGoal } from '../../store/types';
import type { PokemonSpecies } from '../../data/types';

function getSpecies(id: number): PokemonSpecies | undefined {
  if (id !== 1) return undefined;
  return {
    id: 1, name: 'S1', types: ['normal'], spriteUrl: '',
    eggGroups: ['monster'], genderRate: 4, isGenderless: false,
    femaleRatio: 0.5, abilities: ['Overgrow'], moves: [],
  } as unknown as PokemonSpecies;
}
let seq = 0;
function mon(ivs: Partial<OwnedPokemon['ivs']>, gender: 'male' | 'female', id?: string): OwnedPokemon {
  return {
    id: id ?? `m${seq++}`, speciesId: 1,
    ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...ivs },
    nature: 'Hardy', ability: 'Overgrow', isHiddenAbility: false,
    gender, isShiny: false, isAlpha: false, eggMoves: [], createdAt: '2024-01-01T00:00:00.000Z',
  };
}
const goal: BreedingGoal = { speciesId: 1, targetIVs: { hp: 31, atk: 31 } };

const optimizerOn: Settings = {
  ...DEFAULT_SETTINGS,
  features: { ...DEFAULT_SETTINGS.features, costOptimizer: true },
};

describe('selectPlanner', () => {
  it('returns the greedy buildPlan when costOptimizer is off', () => {
    expect(selectPlanner(DEFAULT_SETTINGS)).toBe(buildPlan);
  });

  it('returns a Plan-shaped adapter (not buildPlan) when costOptimizer is on', () => {
    const planner = selectPlanner(optimizerOn);
    expect(planner).not.toBe(buildPlan);
  });

  it('adapter estimate.total matches the optimal plan cost; gaps are described', () => {
    const planner = selectPlanner(optimizerOn);
    const plan = planner([], goal, optimizerOn, getSpecies);
    expect(plan.estimate.cost.total).toBe(40000); // 2-IV fresh: 2 breeds-worth items + 2 carriers
    expect(plan.gaps).toHaveLength(2);
    expect(plan.gaps[0].description).toMatch(/HP|Atk/i);
    expect(plan.recommendation).toBeNull(); // nothing performable from an empty pool
  });

  it('adapter derives a next-breed Recommendation when two owned parents are ready', () => {
    const planner = selectPlanner(optimizerOn);
    const pool = [mon({ hp: 31 }, 'female', 'a'), mon({ atk: 31 }, 'male', 'b')];
    const plan = planner(pool, goal, optimizerOn, getSpecies);
    expect(plan.recommendation).not.toBeNull();
    const ids = [plan.recommendation!.pair.parentAId, plan.recommendation!.pair.parentBId].sort();
    expect(ids).toEqual(['a', 'b']);
  });
});
