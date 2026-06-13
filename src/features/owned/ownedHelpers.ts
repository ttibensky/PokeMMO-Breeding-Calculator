import type { IVs, Gender } from '../../store/types';
import type { PokemonSpecies } from '../../data/types';

const STAT_ORDER: (keyof IVs)[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

export function emptyIVs(): IVs {
  return { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
}

export function countPerfectIVs(ivs: IVs): number {
  return STAT_ORDER.filter((stat) => ivs[stat] === 31).length;
}

export function formatIVs(ivs: IVs): string {
  return STAT_ORDER.map((stat) => ivs[stat]).join('/');
}

export function allowedGenders(species: PokemonSpecies): Gender[] {
  if (species.isGenderless) return ['genderless'];
  if (species.genderRate === 0) return ['male'];
  if (species.genderRate === 8) return ['female'];
  return ['male', 'female'];
}

export function normalAbilities(species: PokemonSpecies): string[] {
  return species.abilities.filter((a) => !a.isHidden).map((a) => a.name);
}

export function hiddenAbility(species: PokemonSpecies): string | undefined {
  return species.abilities.find((a) => a.isHidden)?.name;
}
