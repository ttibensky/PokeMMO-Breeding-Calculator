import type { OwnedPokemon, ItemKey, MechanicConstants } from '../store/types';
import { POWER_ITEM_STAT } from '../store/types';
import type { StatKey, PokemonSpecies } from '../data/types';
import type { StatDistribution, StatOutcome, OffspringPrediction } from './types';
import { validatePair } from './validation';

const DITTO_ID = 132;
const ALL_STATS: StatKey[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

/** Returns the number of Power items (non-everstone) among the held items. */
export function countPowerItems(heldItems: { a?: ItemKey; b?: ItemKey }): 0 | 1 | 2 {
  let count = 0;
  if (heldItems.a && heldItems.a !== 'everstone') count++;
  if (heldItems.b && heldItems.b !== 'everstone') count++;
  return count as 0 | 1 | 2;
}

/**
 * Compute the IV distribution for a single stat.
 *
 * Pinning: if a Power item on a parent forces THIS stat, the child's IV = that holder's IV, p=1.
 * If both parents pin the same stat (unusual), parent A takes precedence.
 *
 * Not-pinned probabilities (per-stat marginal approximation documented in §2):
 *   0 power items: {high:0.25, avg:0.5, low:0.25}
 *     — This is a marginal approximation of the "3-inherited+3-averaged" model, not exact.
 *       The exact per-stat marginal for the no-item case is not fully derivable from
 *       the available documentation; {0.25, 0.5, 0.25} is the symmetric best-effort.
 *   1 power item: mechanics.ivPassChanceOneItem (default 0.2/0.6/0.2)
 *   2 power items: mechanics.ivPassChanceTwoItems (default 0.125/0.75/0.125)
 *
 * Duplicate outcome values are merged (probabilities summed) so totals remain ~1.
 */
export function statDistribution(
  aIV: number,
  bIV: number,
  stat: StatKey,
  heldItems: { a?: ItemKey; b?: ItemKey },
  mechanics: MechanicConstants,
): StatDistribution {
  // Determine if either Power item pins this stat
  const aItem = heldItems.a !== 'everstone' ? heldItems.a : undefined;
  const bItem = heldItems.b !== 'everstone' ? heldItems.b : undefined;

  const aPins = aItem !== undefined && POWER_ITEM_STAT[aItem as Exclude<ItemKey, 'everstone'>] === stat;
  const bPins = bItem !== undefined && POWER_ITEM_STAT[bItem as Exclude<ItemKey, 'everstone'>] === stat;

  if (aPins || bPins) {
    // Parent A takes precedence if both pin the same stat (unusual edge case)
    const pinnedIV = aPins ? aIV : bIV;
    return { outcomes: [{ value: pinnedIV, p: 1 }], pinned: true };
  }

  // When both IVs are equal, all outcomes collapse to one value
  if (aIV === bIV) {
    return { outcomes: [{ value: aIV, p: 1 }], pinned: false };
  }

  const high = Math.max(aIV, bIV);
  const low = Math.min(aIV, bIV);
  const avg = Math.floor((aIV + bIV) / 2);

  const powerCount = countPowerItems(heldItems);

  let pHigh: number;
  let pAvg: number;
  let pLow: number;

  if (powerCount === 1) {
    pHigh = mechanics.ivPassChanceOneItem.high;
    pAvg  = mechanics.ivPassChanceOneItem.avg;
    pLow  = mechanics.ivPassChanceOneItem.low;
  } else if (powerCount === 2) {
    pHigh = mechanics.ivPassChanceTwoItems.high;
    pAvg  = mechanics.ivPassChanceTwoItems.avg;
    pLow  = mechanics.ivPassChanceTwoItems.low;
  } else {
    // 0 power items — symmetric marginal approximation
    pHigh = 0.25;
    pAvg  = 0.5;
    pLow  = 0.25;
  }

  // Accumulate into a map to merge duplicate values (e.g. when high === avg)
  const accumulated = new Map<number, number>();
  const add = (value: number, p: number) =>
    accumulated.set(value, (accumulated.get(value) ?? 0) + p);

  add(high, pHigh);
  add(avg, pAvg);
  add(low, pLow);

  const outcomes: StatOutcome[] = Array.from(accumulated.entries())
    .map(([value, p]) => ({ value, p }))
    .sort((x, y) => y.value - x.value);   // descending for readability

  return { outcomes, pinned: false };
}

/**
 * Probability that the offspring's IV in `stat` equals `target` (default 31).
 */
export function probabilityPerfect(
  aIV: number,
  bIV: number,
  stat: StatKey,
  heldItems: { a?: ItemKey; b?: ItemKey },
  mechanics: MechanicConstants,
  target = 31,
): number {
  const dist = statDistribution(aIV, bIV, stat, heldItems, mechanics);
  return dist.outcomes
    .filter((o) => o.value === target)
    .reduce((sum, o) => sum + o.p, 0);
}

/**
 * Full offspring prediction for a pairing.
 * Pure function: takes parents, held items, mechanics constants, and a species lookup.
 * Mechanics §2 (IVs), §3 (nature), §4 (ability), §7 (alpha), §8 (shiny), §9 (egg moves).
 */
export function predictOffspring(
  a: OwnedPokemon,
  b: OwnedPokemon,
  heldItems: { a?: ItemKey; b?: ItemKey },
  mechanics: MechanicConstants,
  getSpecies: (id: number) => PokemonSpecies | undefined,
): OffspringPrediction {
  const warnings: string[] = [];

  // Validate the pair and extract female-role parent info
  const validation = validatePair(a, b, getSpecies);
  if (!validation.valid) {
    for (const r of validation.reasons) warnings.push(r);
  }

  // Determine which parent is the female-role parent
  const femaleRoleParent =
    validation.femaleRoleParentId === a.id ? a
    : validation.femaleRoleParentId === b.id ? b
    : a;   // fallback: parent A

  const offspringSpeciesId = validation.offspringSpeciesId ?? femaleRoleParent.speciesId;

  // IV distributions for all six stats
  const ivs = {} as Record<StatKey, StatDistribution>;
  for (const stat of ALL_STATS) {
    ivs[stat] = statDistribution(a.ivs[stat], b.ivs[stat], stat, heldItems, mechanics);
  }

  // Nature: if a parent holds Everstone, pass that parent's nature
  // If both hold Everstone, use parent A's.
  let nature: OffspringPrediction['nature'];
  const aHasEverstone = heldItems.a === 'everstone';
  const bHasEverstone = heldItems.b === 'everstone';
  if (aHasEverstone || bHasEverstone) {
    const natureBearing = aHasEverstone ? a : b;
    const chance = mechanics.everstoneGuaranteed ? 1 : 0.5;
    nature = { value: natureBearing.nature, chance };
  }

  // Ability: based on the female-role parent.
  // HA can only propagate from the female-role parent.
  // Warn if the OTHER parent has HA but the female-role parent does not.
  const otherParent = femaleRoleParent === a ? b : a;
  if (!femaleRoleParent.isHiddenAbility && otherParent.isHiddenAbility) {
    warnings.push(
      'Hidden Ability can only pass from the female-role parent; the HA carrier is not the female-role parent in this pairing',
    );
  }

  let ability: OffspringPrediction['ability'];
  // Ditto cannot carry an HA for passing (§4)
  if (!isDitto(femaleRoleParent.speciesId)) {
    ability = {
      value: femaleRoleParent.ability,
      chance: mechanics.abilityPassRate,
      isHidden: femaleRoleParent.isHiddenAbility,
    };
  }

  // Shiny: guaranteed if both parents are shiny (§8)
  const isShiny = a.isShiny && b.isShiny;

  // Alpha: only if both parents are Alpha (§7)
  const isAlpha = a.isAlpha && b.isAlpha;

  // Egg moves: union of parent moves that the offspring species can learn (§9)
  const offspringSpecies = getSpecies(offspringSpeciesId);
  const learnableSet = new Set(
    (offspringSpecies?.moves ?? []).map((m) => m.toLowerCase()),
  );
  const parentMoves = new Set([
    ...a.eggMoves.map((m) => m.toLowerCase()),
    ...b.eggMoves.map((m) => m.toLowerCase()),
  ]);
  const possibleEggMoves: string[] = [];
  for (const move of parentMoves) {
    if (learnableSet.has(move)) possibleEggMoves.push(move);
  }

  return {
    offspringSpeciesId,
    ivs,
    nature,
    ability,
    isShiny,
    isAlpha,
    possibleEggMoves,
    warnings,
  };
}

function isDitto(speciesId: number): boolean {
  return speciesId === DITTO_ID;
}
