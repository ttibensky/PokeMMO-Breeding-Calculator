import { describe, it, expect } from 'vitest';
import { computeReservations } from './reservations';
import type { OwnedPokemon, BreedingProject } from '../../store/types';
import type { PokemonSpecies } from '../../data/types';

let _id = 0;
const fid = () => `mon-${++_id}`;

function makeMon(o: Partial<OwnedPokemon> = {}): OwnedPokemon {
  return {
    id: fid(), speciesId: 1,
    ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    nature: 'Hardy', ability: 'Overgrow', isHiddenAbility: false,
    gender: 'female', isShiny: false, isAlpha: false, eggMoves: [],
    createdAt: '2024-01-01T00:00:00.000Z', ...o,
  };
}

function makeProject(o: Partial<BreedingProject> = {}): BreedingProject {
  return {
    id: `proj-${++_id}`, name: 'Project',
    goal: { speciesId: 1, targetIVs: {} }, status: 'in-progress',
    progress: [], createdAt: '2024-01-01T00:00:00.000Z', ...o,
  };
}

function makeSpecies(id: number, p: Partial<PokemonSpecies> = {}): PokemonSpecies {
  return {
    id, name: `Species${id}`, types: ['normal'], spriteUrl: '',
    eggGroups: ['monster'], genderRate: 4, isGenderless: false, femaleRatio: 0.5,
    abilities: [{ name: 'Overgrow', isHidden: false }], moves: [], ...p,
  };
}
const SPECIES: Record<number, PokemonSpecies> = { 1: makeSpecies(1) };
const getSpecies = (id: number): PokemonSpecies | undefined => SPECIES[id];

describe('computeReservations', () => {
  it('returns an empty map when there are no projects', () => {
    const mon = makeMon({ ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
    expect(computeReservations([mon], [], getSpecies)).toEqual({});
  });

  it('maps an owned mon to the in-progress project whose plan reserves it', () => {
    const mon = makeMon({ ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
    const proj = makeProject({ id: 'p1', name: 'HP/Atk', goal: { speciesId: 1, targetIVs: { hp: 31, atk: 31 } }, status: 'in-progress' });
    const map = computeReservations([mon], [proj], getSpecies);
    expect(map[mon.id]).toEqual([{ projectId: 'p1', projectName: 'HP/Atk' }]);
  });

  it('flags a conflict when two in-progress projects reserve the same mon', () => {
    const mon = makeMon({ ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
    const a = makeProject({ id: 'a', name: 'A', goal: { speciesId: 1, targetIVs: { hp: 31, atk: 31 } } });
    const b = makeProject({ id: 'b', name: 'B', goal: { speciesId: 1, targetIVs: { hp: 31, def: 31 } } });
    const map = computeReservations([mon], [a, b], getSpecies);
    expect(map[mon.id]).toHaveLength(2);
    expect(map[mon.id].map((r) => r.projectId).sort()).toEqual(['a', 'b']);
  });

  it('ignores planning, done, and abandoned projects', () => {
    const mon = makeMon({ ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
    const goal = { speciesId: 1, targetIVs: { hp: 31 as const, atk: 31 as const } };
    for (const status of ['planning', 'done', 'abandoned'] as const) {
      expect(computeReservations([mon], [makeProject({ goal, status })], getSpecies)).toEqual({});
    }
  });

  it('does not list a mon that no plan reserves', () => {
    const free = makeMon({ ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
    const proj = makeProject({ goal: { speciesId: 1, targetIVs: { hp: 31, atk: 31 } }, status: 'in-progress' });
    const map = computeReservations([free], [proj], getSpecies);
    expect(map[free.id]).toBeUndefined();
  });
});
