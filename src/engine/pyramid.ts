import type { BreedingGoal } from '../store/types';
import type { StatKey } from '../data/types';

/**
 * Count the number of "attributes" in a breeding goal.
 * Each perfect (31) IV stat counts as one attribute; nature counts as one if present.
 * Ability, gender, and shiny do NOT multiply the tree.
 */
export function attributeCount(goal: BreedingGoal): number {
  const ivCount = (Object.keys(goal.targetIVs) as StatKey[]).filter(
    (s) => goal.targetIVs[s] === 31,
  ).length;
  return ivCount + (goal.nature ? 1 : 0);
}

/**
 * Number of single-31-IV base Pokémon needed for a given attribute count.
 * Formula: 2^(attributes - 1).  0 attributes → 0 base mons.
 */
export function baseMonsNeeded(attributes: number): number {
  if (attributes <= 0) return 0;
  return 1 << (attributes - 1);   // exact integer, no floating point
}

/**
 * Total internal breeds (nodes) in the pyramid for a given attribute count.
 * Formula: 2^(attributes - 1) - 1.  0 attributes → 0 breeds.
 */
export function totalBreeds(attributes: number): number {
  if (attributes <= 0) return 0;
  return (1 << (attributes - 1)) - 1;
}

/**
 * Pre-computed table for attributes 1..6.
 * Matches mechanics §6:
 *   1 → {1,0}, 2 → {2,1}, 3 → {4,3}, 4 → {8,7}, 5 → {16,15}, 6 → {32,31}
 */
export const PYRAMID_TABLE: Record<number, { baseMons: number; totalBreeds: number }> = {
  1: { baseMons: 1,  totalBreeds: 0  },
  2: { baseMons: 2,  totalBreeds: 1  },
  3: { baseMons: 4,  totalBreeds: 3  },
  4: { baseMons: 8,  totalBreeds: 7  },
  5: { baseMons: 16, totalBreeds: 15 },
  6: { baseMons: 32, totalBreeds: 31 },
};
