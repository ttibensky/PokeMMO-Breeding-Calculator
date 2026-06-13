import type { StatKey, IVs, Gender } from '../data/types';

export type { StatKey, IVs, Gender };

export type ItemKey =
  | 'powerWeight'   // HP
  | 'powerBracer'   // Attack
  | 'powerBelt'     // Defense
  | 'powerLens'     // Sp. Atk
  | 'powerBand'     // Sp. Def
  | 'powerAnklet'   // Speed
  | 'everstone';

// Map Power item -> the StatKey it forces (engine will use it)
export const POWER_ITEM_STAT: Record<Exclude<ItemKey, 'everstone'>, StatKey> = {
  powerWeight: 'hp',
  powerBracer: 'atk',
  powerBelt: 'def',
  powerLens: 'spa',
  powerBand: 'spd',
  powerAnklet: 'spe',
};

export interface OwnedPokemon {
  id: string;
  speciesId: number;
  ivs: IVs;
  nature: string;
  ability: string;
  isHiddenAbility: boolean;
  gender: Gender;
  isShiny: boolean;
  isAlpha: boolean;
  eggMoves: string[];
  notes?: string;
  createdAt: string;
}

export interface BreedingGoal {
  speciesId: number;
  targetIVs: Partial<Record<StatKey, 31>>;   // 2..6 perfect stats selected
  nature?: string;
  ability?: string;
  requireHiddenAbility?: boolean;
  gender?: Gender;
  requireShiny?: boolean;
  eggMoves?: string[];
}

export interface BreedStepResult {
  id: string;
  parentAId: string;
  parentBId: string;
  heldItems: { a?: ItemKey; b?: ItemKey };
  forcedGender?: Gender;
  resultPokemonId: string;
  costSpent: number;
  reportedAt: string;
}

export type ProjectStatus = 'planning' | 'in-progress' | 'done' | 'abandoned';

export interface BreedingProject {
  id: string;
  name: string;
  goal: BreedingGoal;
  status: ProjectStatus;
  progress: BreedStepResult[];
  createdAt: string;
}

export type PriceKey = ItemKey | 'genderFeeBase' | 'genderFeeMax' | 'abilityPill' | 'ditto';

export interface MechanicConstants {
  everstoneConsumed: boolean;
  everstoneGuaranteed: boolean;
  ivPassChanceOneItem: { high: number; avg: number; low: number };
  ivPassChanceTwoItems: { high: number; avg: number; low: number };
  abilityPassRate: number;
  regionalFormsSupported: boolean;
}

export interface FeatureToggles {
  eggMoves: boolean;
  hiddenAbility: boolean;
  shiny: boolean;
  alpha: boolean;
}

export interface Settings {
  prices: Record<PriceKey, number>;
  features: FeatureToggles;
  mechanics: MechanicConstants;
}
