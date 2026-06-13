export type StatKey = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export type IVs = Record<StatKey, number>; // 0..31
export type Gender = 'male' | 'female' | 'genderless';

export interface Ability {
  name: string;
  isHidden: boolean;
}

export interface PokemonSpecies {
  id: number;
  name: string;
  types: string[];
  spriteUrl: string;
  eggGroups: string[];
  genderRate: number;
  isGenderless: boolean;
  femaleRatio: number;
  abilities: Ability[];
  moves: string[];
}

export interface PokemonDataset {
  generatedAt: string;
  source: string;
  speciesRange: [number, number];
  species: PokemonSpecies[];
}
