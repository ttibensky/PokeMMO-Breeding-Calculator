import type { PokemonSpecies } from '../data/types';
import { DITTO_ID } from '../data/index';
import { sharesEggGroup, isCompatible, carriesAttribute, targetAttributes } from './planner';
import type { OwnedPokemon, BreedingGoal } from '../store/types';
import type { Attribute } from './types';

/**
 * Species that can contribute attributes into a breeding project for `targetSpeciesId`.
 * Offspring take the mother's species, so contributors are acquired as males (or Ditto);
 * genderless non-Ditto species and `no-eggs` species cannot feed the target line.
 */
export function getCompatibleSpecies(
  targetSpeciesId: number,
  getSpecies: (id: number) => PokemonSpecies | undefined,
  all: PokemonSpecies[],
): PokemonSpecies[] {
  const target = getSpecies(targetSpeciesId);
  if (!target) return [];
  if (target.eggGroups.includes('no-eggs')) return []; // cannot be bred at all
  const ditto = getSpecies(DITTO_ID);
  if (target.isGenderless) return ditto ? [ditto] : []; // breedable only with Ditto

  const pool = all
    .filter(
      (s) =>
        s.id !== targetSpeciesId &&
        s.id !== DITTO_ID &&
        !s.eggGroups.includes('no-eggs') &&
        !s.isGenderless &&
        sharesEggGroup(s, target),
    )
    .sort((a, b) => a.id - b.id);

  return ditto ? [ditto, ...pool] : pool;
}

export interface AttributeCoverage {
  attribute: Attribute;
  carriers: OwnedPokemon[];
  isGap: boolean;
}

/** A mon can feed the target line if it's the same species, a Ditto, or a different-species male. */
function canContribute(mon: OwnedPokemon, goal: BreedingGoal): boolean {
  if (mon.speciesId === goal.speciesId) return true;
  if (mon.speciesId === DITTO_ID) return true;
  return mon.gender === 'male';
}

export function computeCoverage(
  goal: BreedingGoal,
  owned: OwnedPokemon[],
  getSpecies: (id: number) => PokemonSpecies | undefined,
): AttributeCoverage[] {
  return targetAttributes(goal).map((attribute) => {
    const carriers = owned.filter(
      (mon) =>
        isCompatible(mon, goal, getSpecies) &&
        carriesAttribute(mon, attribute) &&
        canContribute(mon, goal),
    );
    return { attribute, carriers, isGap: carriers.length === 0 };
  });
}
