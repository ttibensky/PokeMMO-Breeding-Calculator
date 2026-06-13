import type { OwnedPokemon, BreedingGoal, ItemKey, Settings } from '../store/types';
import { POWER_ITEM_STAT } from '../store/types';
import type { Gender, PokemonSpecies } from '../data/types';
import type { CostBreakdown, GoalEstimate } from './types';
import { attributeCount, baseMonsNeeded, totalBreeds } from './pyramid';

const DITTO_ID = 132;

function isDitto(speciesId: number): boolean {
  return speciesId === DITTO_ID;
}

/**
 * Gender-fee scaling from species female ratio.
 * Endpoints from §5: $5,000 at 1:1 (femaleRatio=0.5), $25,000 at 7:1 (femaleRatio=0.125).
 * skew = clamp(|0.5 - femaleRatio| / (0.5 - 0.125), 0, 1)
 * fee  = round(base + (max - base) * skew)
 */
export function scaledGenderFee(
  femaleRatio: number,
  prices: Settings['prices'],
): number {
  const base = prices.genderFeeBase;
  const max  = prices.genderFeeMax;
  const rawSkew = Math.abs(0.5 - femaleRatio) / (0.5 - 0.125);
  const skew = Math.min(1, Math.max(0, rawSkew));
  return Math.round(base + (max - base) * skew);
}

/**
 * Mean price of the six Power items.
 */
export function averagePowerItemPrice(prices: Settings['prices']): number {
  const powerKeys = Object.keys(POWER_ITEM_STAT) as Array<Exclude<ItemKey, 'everstone'>>;
  const sum = powerKeys.reduce((acc, k) => acc + prices[k], 0);
  return sum / powerKeys.length;
}

/**
 * High-level cost estimate for a breeding goal.
 * Uses pyramid math plus per-breed cost assumptions.
 * Assumptions that apply are appended to `assumptions`.
 */
export function estimateGoal(
  goal: BreedingGoal,
  settings: Settings,
  getSpecies: (id: number) => PokemonSpecies | undefined,
): GoalEstimate {
  const attrs   = attributeCount(goal);
  const baseMons = baseMonsNeeded(attrs);
  const breeds  = totalBreeds(attrs);
  const prices  = settings.prices;
  const mechanics = settings.mechanics;
  const assumptions: string[] = [];

  const species = getSpecies(goal.speciesId);
  const femaleRatio = species?.femaleRatio ?? 0.5;
  const genderless  = species?.isGenderless ?? false;

  // Power items: two per breed (one on each parent), at average price
  const avgPower = averagePowerItemPrice(prices);
  const powerItems = breeds * 2 * avgPower;
  assumptions.push('Probabilistic — pin counts assume one Power item per parent per internal breed');

  // Everstone: carried up the nature lineage.
  // If consumed per breed: needed for each of the (attributes-1) internal layers where
  // the nature carrier is bred into the line (i.e. every breed except the very first
  // base acquisition). We conservatively model it as (attrs-1) stones consumed.
  // If reusable, only 1 is ever needed.
  let everstoneCount = 0;
  let everstone = 0;
  if (goal.nature) {
    if (mechanics.everstoneConsumed) {
      everstoneCount = Math.max(0, attrs - 1);
      assumptions.push('Everstone treated as consumed per breed');
    } else {
      everstoneCount = 1;
      assumptions.push('Everstone treated as reusable (one stone for the whole line)');
    }
    everstone = everstoneCount * prices.everstone;
  }

  // Gender fees: paid per breed when the user wants a specific gender and the
  // species is not genderless (genderless lines use Ditto instead).
  let genderFees = 0;
  if (!genderless && goal.gender) {
    const fee = scaledGenderFee(femaleRatio, prices);
    genderFees = breeds * fee;
    assumptions.push(
      `Gender fee applied to every breed (${(femaleRatio * 100).toFixed(0)}% female ratio → $${fee.toLocaleString()}/breed)`,
    );
  }

  // Ditto: one per breed for genderless lines (Ditto is consumed as a parent each time)
  const ditto = genderless ? breeds * prices.ditto : 0;
  if (genderless) {
    assumptions.push('Genderless line: a Ditto per breed (consumed as parent)');
  }

  // Ability Pill: one-off post-breed fix for a regular (non-HA) ability switch
  const abilityPill =
    goal.ability && !goal.requireHiddenAbility ? prices.abilityPill : 0;
  if (abilityPill > 0) {
    assumptions.push('One Ability Pill included as a post-breed regular-ability fix');
  }

  const total = powerItems + everstone + genderFees + ditto + abilityPill;

  const cost: CostBreakdown = {
    powerItems,
    everstone,
    genderFees,
    abilityPill,
    ditto,
    total,
  };

  return { attributeCount: attrs, baseMonsNeeded: baseMons, totalBreeds: breeds, cost, assumptions };
}

/**
 * Actual cost of one reported breed step, summing held items and any fee paid.
 * - Each held Power item costs its price (consumed per breed).
 * - Everstone costs its price if mechanics.everstoneConsumed and either parent holds one.
 * - Gender fee added if forcedGender is set and the offspring species is not genderless.
 * - Ditto price added if either parent is Ditto.
 */
export function computeStepCost(
  a: OwnedPokemon,
  b: OwnedPokemon,
  heldItems: { a?: ItemKey; b?: ItemKey },
  forcedGender: Gender | undefined,
  settings: Settings,
  getSpecies: (id: number) => PokemonSpecies | undefined,
): number {
  const prices = settings.prices;
  const mechanics = settings.mechanics;
  let cost = 0;

  // Power items (held by either parent)
  for (const item of [heldItems.a, heldItems.b]) {
    if (item && item !== 'everstone') {
      cost += prices[item];
    }
  }

  // Everstone (consumed if the mechanic says so)
  if (mechanics.everstoneConsumed) {
    const hasEverstone = heldItems.a === 'everstone' || heldItems.b === 'everstone';
    if (hasEverstone) cost += prices.everstone;
  }

  // Gender-selection fee
  if (forcedGender !== undefined) {
    // Determine offspring species: non-Ditto parent, or female parent
    let offspringSpeciesId: number | undefined;
    if (isDitto(a.speciesId) && !isDitto(b.speciesId)) {
      offspringSpeciesId = b.speciesId;
    } else if (isDitto(b.speciesId) && !isDitto(a.speciesId)) {
      offspringSpeciesId = a.speciesId;
    } else {
      offspringSpeciesId = a.gender === 'female' ? a.speciesId : b.speciesId;
    }
    const offspringSpecies = offspringSpeciesId !== undefined
      ? getSpecies(offspringSpeciesId)
      : undefined;
    if (!offspringSpecies?.isGenderless) {
      const femaleRatio = offspringSpecies?.femaleRatio ?? 0.5;
      cost += scaledGenderFee(femaleRatio, prices);
    }
  }

  // Ditto cost (Ditto is consumed as a parent)
  if (isDitto(a.speciesId) || isDitto(b.speciesId)) {
    cost += prices.ditto;
  }

  return cost;
}

/**
 * Compare total actual spending against the original estimate.
 */
export function actualVsEstimate(
  progressCostSpent: number[],
  estimateTotal: number,
): { spent: number; estimate: number; delta: number } {
  const spent = progressCostSpent.reduce((s, c) => s + c, 0);
  return { spent, estimate: estimateTotal, delta: spent - estimateTotal };
}
