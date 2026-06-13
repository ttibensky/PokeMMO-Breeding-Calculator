import type { PokemonSpecies } from '../data/types';
import { DITTO_ID } from '../data/index';
import { sharesEggGroup } from './planner';

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
