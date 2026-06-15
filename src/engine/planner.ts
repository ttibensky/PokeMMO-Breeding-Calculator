/**
 * Breeding Planner — greedy best-next-pair heuristic.
 *
 * Scoring heuristic (simple and explainable):
 *   Primary:   number of guaranteedTargetStats in predicted child (more merged 31s = better).
 *   Secondary: +1 bonus if an Everstone is assigned to a nature-matching parent when goal needs nature.
 *   Tie-break: prefer a pair whose child's guaranteed count strictly exceeds the max of either
 *              parent's own target-31 count (real progress), then prefer pairs that keep a viable
 *              female-role carrier (intermediate breeds need a female outcome).
 *
 * Item assignment:
 *   Build an inverted stat→item map from POWER_ITEM_STAT.
 *   For each parent, collect the target stats where it has IV===31.
 *   Pin parentA's most valuable stat (prefer a stat the other parent is NOT 31 in) via its Power item.
 *   Pin parentB's most valuable stat (prefer a different stat than A's) via its Power item.
 *   If a parent has no useful target stat but carries the needed nature, give it an Everstone.
 *
 * forcedGender:
 *   If the predicted child would satisfy goalMet (final breed) and goal.gender is set → use goal.gender.
 *   Else if the line is non-genderless (no Ditto involved) → 'female' (intermediate female carrier needed).
 *   For genderless lines (either parent is Ditto) → undefined.
 *
 * done / gaps / null-recommendation:
 *   done=true when any pool mon already satisfies goalMet. recommendation is then null.
 *   gaps lists target attributes for which NO compatible carrier exists in the pool.
 *   recommendation is null when no valid pair exists or no pair makes real progress.
 */

import type { OwnedPokemon, BreedingGoal, ItemKey, Settings } from '../store/types';
import { POWER_ITEM_STAT } from '../store/types';
import type { Gender, StatKey, PokemonSpecies } from '../data/types';
import type { Attribute, OffspringPrediction, GoalEstimate } from './types';
import { validatePair } from './validation';
import { statDistribution, predictOffspring } from './inheritance';
import { estimateGoal, computeStepCost } from './cost';
import type { ValidationResult } from './types';

const DITTO_ID = 132;

// Human-readable labels for stat keys
const STAT_LABEL: Record<StatKey, string> = {
  hp:  'HP',
  atk: 'Atk',
  def: 'Def',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'Spe',
};

// Inverted map: StatKey → the Power ItemKey that pins it
const STAT_TO_POWER_ITEM: Record<StatKey, Exclude<ItemKey, 'everstone'>> = {
  hp:  'powerWeight',
  atk: 'powerBracer',
  def: 'powerBelt',
  spa: 'powerLens',
  spd: 'powerBand',
  spe: 'powerAnklet',
};

// ─── Planner-specific types ─────────────────────────────────────────────────

export interface Gap {
  attribute: Attribute;
  description: string;
}

export interface PairCandidate {
  parentAId: string;
  parentBId: string;
  items: { a?: ItemKey; b?: ItemKey };
  forcedGender?: Gender;
  prediction: OffspringPrediction;
  /** Target stats that are 31 with certainty in the predicted child */
  guaranteedTargetStats: StatKey[];
  score: number;
  estimatedStepCost: number;
}

export interface Recommendation {
  pair: PairCandidate;
  alternativesForA: string[];
  alternativesForB: string[];
  warnings: string[];
}

export interface Plan {
  goal: BreedingGoal;
  /** Pool already contains a mon meeting the goal */
  done: boolean;
  matchingPokemonId?: string;
  /** null when no productive valid pair exists in the pool */
  recommendation: Recommendation | null;
  /** Full-goal cost estimate */
  estimate: GoalEstimate;
  /** Target attributes with no compatible owned carrier */
  gaps: Gap[];
}

// ─── Pure helper functions ───────────────────────────────────────────────────

/** Stats whose targetIVs value is 31. */
export function targetStats(goal: BreedingGoal): StatKey[] {
  return (Object.keys(goal.targetIVs) as StatKey[]).filter(
    (s) => goal.targetIVs[s] === 31,
  );
}

/** IV attributes for each target stat + a nature attribute if goal.nature set. */
export function targetAttributes(goal: BreedingGoal): Attribute[] {
  const attrs: Attribute[] = targetStats(goal).map((stat) => ({ kind: 'iv', stat }));
  if (goal.nature) {
    attrs.push({ kind: 'nature', nature: goal.nature });
  }
  return attrs;
}

/**
 * Returns true if `mon` satisfies every requirement of the breeding goal.
 */
export function goalMet(
  mon: OwnedPokemon,
  goal: BreedingGoal,
  getSpecies?: (id: number) => PokemonSpecies | undefined,
): boolean {
  void getSpecies;
  if (mon.speciesId !== goal.speciesId) return false;
  for (const stat of targetStats(goal)) {
    if (mon.ivs[stat] !== 31) return false;
  }
  if (goal.nature && mon.nature !== goal.nature) return false;
  if (goal.requireHiddenAbility && !mon.isHiddenAbility) return false;
  if (goal.ability && mon.ability !== goal.ability) return false;
  if (goal.gender && mon.gender !== goal.gender) return false;
  if (goal.requireShiny && !mon.isShiny) return false;
  if (goal.eggMoves && goal.eggMoves.length > 0) {
    const monMoves = new Set(mon.eggMoves.map((m) => m.toLowerCase()));
    for (const move of goal.eggMoves) {
      if (!monMoves.has(move.toLowerCase())) return false;
    }
  }
  return true;
}

export function sharesEggGroup(a: PokemonSpecies, b: PokemonSpecies): boolean {
  return a.eggGroups.some((g) => b.eggGroups.includes(g));
}

/**
 * Returns true if `mon` can participate in this species' breeding line:
 * it is the target species, OR it is Ditto, OR it shares an egg group with the target species.
 */
export function isCompatible(
  mon: OwnedPokemon,
  goal: BreedingGoal,
  getSpecies: (id: number) => PokemonSpecies | undefined,
): boolean {
  if (mon.speciesId === goal.speciesId) return true;
  if (mon.speciesId === DITTO_ID) return true;
  const monSpecies = getSpecies(mon.speciesId);
  const targetSpecies = getSpecies(goal.speciesId);
  if (!monSpecies || !targetSpecies) return false;
  return sharesEggGroup(monSpecies, targetSpecies);
}

/**
 * Returns true if `mon` carries the given attribute:
 * iv → mon.ivs[stat]===31; nature → mon.nature===attr.nature.
 */
export function carriesAttribute(
  mon: OwnedPokemon,
  attr: Attribute,
  goal?: BreedingGoal,
): boolean {
  void goal;
  if (attr.kind === 'iv') return mon.ivs[attr.stat] === 31;
  return mon.nature === attr.nature;
}

/**
 * For each target attribute, if no compatible owned mon carries it, emit a Gap.
 */
export function identifyGaps(
  pool: OwnedPokemon[],
  goal: BreedingGoal,
  getSpecies: (id: number) => PokemonSpecies | undefined,
): Gap[] {
  const compatible = pool.filter((m) => isCompatible(m, goal, getSpecies));
  const targetSpecies = getSpecies(goal.speciesId);
  const speciesName = targetSpecies?.name ?? `#${goal.speciesId}`;
  const gaps: Gap[] = [];

  for (const attr of targetAttributes(goal)) {
    const hasCarrier = compatible.some((m) => carriesAttribute(m, attr, goal));
    if (!hasCarrier) {
      let description: string;
      if (attr.kind === 'iv') {
        const label = STAT_LABEL[attr.stat];
        description =
          `Acquire a Pokémon with 31 ${label} that can breed into ${speciesName}` +
          ` (catch a 1×31 or breed one)`;
      } else {
        description =
          `Acquire a ${attr.nature}-nature Pokémon to carry the nature via Everstone`;
      }
      gaps.push({ attribute: attr, description });
    }
  }

  return gaps;
}

// ─── Internal helpers for pair building ─────────────────────────────────────

function isDittoInvolved(a: OwnedPokemon, b: OwnedPokemon): boolean {
  return a.speciesId === DITTO_ID || b.speciesId === DITTO_ID;
}

/**
 * Count how many of the goal's target stats a mon has at 31.
 */
function countTargetPerfect(mon: OwnedPokemon, goal: BreedingGoal): number {
  return targetStats(goal).filter((s) => mon.ivs[s] === 31).length;
}

/**
 * Assign Power items (and possibly Everstones) to a pair of parents.
 *
 * Algorithm:
 *  1. Collect each parent's "useful" target stats (target stat where that parent has 31).
 *  2. For parentA: prefer a stat the OTHER parent does NOT have 31 in (merge distinct stats).
 *     Among ties, prefer any useful stat. Assign its Power item to slot a.
 *  3. For parentB: same logic, but also avoid the stat A already pinned (different stat preferred).
 *  4. If a parent has no useful target stat AND goal.nature is set AND parent.nature===goal.nature
 *     AND no Everstone assigned yet → give it Everstone.
 *  5. At most one item per parent slot.
 */
function assignItems(
  a: OwnedPokemon,
  b: OwnedPokemon,
  goal: BreedingGoal,
): { a?: ItemKey; b?: ItemKey } {
  const tStats = targetStats(goal);

  // Useful stats for each parent
  const usefulA = tStats.filter((s) => a.ivs[s] === 31);
  const usefulB = tStats.filter((s) => b.ivs[s] === 31);

  let itemA: ItemKey | undefined;
  let itemB: ItemKey | undefined;

  // Assign to A: prefer stat B doesn't have 31 in
  if (usefulA.length > 0) {
    const distinctForA = usefulA.filter((s) => b.ivs[s] !== 31);
    const chosenStatA = distinctForA.length > 0 ? distinctForA[0] : usefulA[0];
    itemA = STAT_TO_POWER_ITEM[chosenStatA];
  }

  // Assign to B: prefer stat A doesn't have 31 in AND different from A's chosen stat
  const aPinnedStat = itemA ? POWER_ITEM_STAT[itemA as Exclude<ItemKey, 'everstone'>] : undefined;
  if (usefulB.length > 0) {
    const distinctForB = usefulB.filter(
      (s) => a.ivs[s] !== 31 && s !== aPinnedStat,
    );
    const differentFromA = usefulB.filter((s) => s !== aPinnedStat);
    const chosenStatB =
      distinctForB.length > 0
        ? distinctForB[0]
        : differentFromA.length > 0
          ? differentFromA[0]
          : usefulB[0];
    itemB = STAT_TO_POWER_ITEM[chosenStatB];
  }

  // Nature via Everstone: if goal needs nature, assign Everstone to a nature-matching parent
  // that doesn't already have a power item, and only if no Everstone assigned yet.
  if (goal.nature) {
    if (!itemA && a.nature === goal.nature) {
      itemA = 'everstone';
    } else if (!itemB && b.nature === goal.nature) {
      itemB = 'everstone';
    }
  }

  return { a: itemA, b: itemB };
}

/**
 * Determine the guaranteed target stats in the predicted offspring.
 * A stat is guaranteed 31 if:
 *   - The distribution is pinned AND pinned value === 31, OR
 *   - Both parents have 31 (distribution collapses to single outcome of 31).
 */
export function computeGuaranteedTargetStats(
  a: OwnedPokemon,
  b: OwnedPokemon,
  items: { a?: ItemKey; b?: ItemKey },
  goal: BreedingGoal,
  mechanics: Settings['mechanics'],
): StatKey[] {
  const tStats = targetStats(goal);
  const guaranteed: StatKey[] = [];
  for (const stat of tStats) {
    const dist = statDistribution(a.ivs[stat], b.ivs[stat], stat, items, mechanics);
    const is31 =
      (dist.pinned && dist.outcomes.length === 1 && dist.outcomes[0].value === 31) ||
      (!dist.pinned && dist.outcomes.length === 1 && dist.outcomes[0].value === 31);
    if (is31) guaranteed.push(stat);
  }
  return guaranteed;
}

/**
 * Determine if the nature is being guaranteed in this step.
 */
function natureCarried(
  a: OwnedPokemon,
  b: OwnedPokemon,
  items: { a?: ItemKey; b?: ItemKey },
  goal: BreedingGoal,
): boolean {
  if (!goal.nature) return false;
  const aHasEverstone = items.a === 'everstone';
  const bHasEverstone = items.b === 'everstone';
  if (!aHasEverstone && !bHasEverstone) return false;
  const natureBearing = aHasEverstone ? a : b;
  // Count as "carried" even at 50% chance — the nature is being actively propagated this step
  return natureBearing.nature === goal.nature;
}

/**
 * Determine forcedGender for a breed step.
 */
function determineForcedGender(
  predictedIsFinal: boolean,
  goal: BreedingGoal,
  dittoInvolved: boolean,
): Gender | undefined {
  if (dittoInvolved) return undefined;
  if (predictedIsFinal && goal.gender) return goal.gender;
  // Intermediate step on a sexed line → want a female carrier
  if (!predictedIsFinal) return 'female';
  return undefined;
}

/**
 * Build a PairCandidate from two mons, goal, and settings.
 * Returns null if the pair is invalid.
 */
function buildCandidate(
  a: OwnedPokemon,
  b: OwnedPokemon,
  goal: BreedingGoal,
  settings: Settings,
  getSpecies: (id: number) => PokemonSpecies | undefined,
): PairCandidate | null {
  const validation = validatePair(a, b, getSpecies);
  if (!validation.valid) return null;

  const items = assignItems(a, b, goal);
  const prediction = predictOffspring(a, b, items, settings.mechanics, getSpecies);
  const guaranteedTargetStats = computeGuaranteedTargetStats(a, b, items, goal, settings.mechanics);

  // Simulate if this child could meet the goal (to decide if this is the "final" breed)
  // We approximate: if guaranteedTargetStats covers all target stats AND nature is handled
  const tStats = targetStats(goal);
  const allStatsGuaranteed = tStats.every((s) => guaranteedTargetStats.includes(s));
  const natureOk = !goal.nature || natureCarried(a, b, items, goal);
  const predictedIsFinal = allStatsGuaranteed && natureOk;

  const dittoInvolved = isDittoInvolved(a, b);
  const forcedGender = determineForcedGender(predictedIsFinal, goal, dittoInvolved);

  const estimatedStepCost = computeStepCost(a, b, items, forcedGender, settings, getSpecies);

  // Score: primary = guaranteedTargetStats count; +1 for nature carried; tie-break is handled externally
  const natBonus = goal.nature && natureCarried(a, b, items, goal) ? 1 : 0;
  const score = guaranteedTargetStats.length + natBonus;

  return {
    parentAId: a.id,
    parentBId: b.id,
    items,
    forcedGender,
    prediction,
    guaranteedTargetStats,
    score,
    estimatedStepCost,
  };
}

/**
 * Count how many target stats a given PairCandidate's child is guaranteed to have at 31.
 */
function candidateProgress(candidate: PairCandidate, maxParentPerfect: number): boolean {
  // "Real progress": child's guaranteed count > max of either parent's own target-31 count
  return candidate.guaranteedTargetStats.length > maxParentPerfect;
}

// ─── Main planning functions ─────────────────────────────────────────────────

/**
 * Recommend the best next pair to breed from the pool.
 * Returns null when no productive valid pair exists.
 */
export function recommendNextPair(
  pool: OwnedPokemon[],
  goal: BreedingGoal,
  settings: Settings,
  getSpecies: (id: number) => PokemonSpecies | undefined,
): Recommendation | null {
  // 1. Scope to compatible mons
  const compatible = pool.filter((m) => isCompatible(m, goal, getSpecies));

  if (compatible.length < 2) return null;

  // 2. Enumerate unordered pairs and build candidates
  const candidates: Array<{
    candidate: PairCandidate;
    a: OwnedPokemon;
    b: OwnedPokemon;
    maxParentPerfect: number;
  }> = [];

  for (let i = 0; i < compatible.length; i++) {
    for (let j = i + 1; j < compatible.length; j++) {
      const a = compatible[i];
      const b = compatible[j];
      const candidate = buildCandidate(a, b, goal, settings, getSpecies);
      if (!candidate) continue;
      const maxParentPerfect = Math.max(
        countTargetPerfect(a, goal),
        countTargetPerfect(b, goal),
      );
      candidates.push({ candidate, a, b, maxParentPerfect });
    }
  }

  if (candidates.length === 0) return null;

  // 3. Score and select best candidate
  // Sort by: score desc, then candidateProgress (true > false), then step cost asc
  candidates.sort((x, y) => {
    if (y.candidate.score !== x.candidate.score) return y.candidate.score - x.candidate.score;
    const xProg = candidateProgress(x.candidate, x.maxParentPerfect) ? 1 : 0;
    const yProg = candidateProgress(y.candidate, y.maxParentPerfect) ? 1 : 0;
    if (yProg !== xProg) return yProg - xProg;
    return x.candidate.estimatedStepCost - y.candidate.estimatedStepCost;
  });

  const best = candidates[0];

  // 4. Check if best pair makes any progress at all
  // No progress = child's guaranteed count ≤ max parent's count AND no nature advancement
  const natAdvance =
    goal.nature &&
    natureCarried(best.a, best.b, best.candidate.items, goal);
  const makesProgress =
    candidateProgress(best.candidate, best.maxParentPerfect) || natAdvance;

  if (!makesProgress) return null;

  // 5. Find alternatives for A and B
  // For A: other compatible mons that carry the SAME pinned target stat as A
  const aPinnedItem = best.candidate.items.a;
  const bPinnedItem = best.candidate.items.b;

  const aPinnedStat: StatKey | undefined =
    aPinnedItem && aPinnedItem !== 'everstone'
      ? POWER_ITEM_STAT[aPinnedItem as Exclude<ItemKey, 'everstone'>]
      : undefined;
  const bPinnedStat: StatKey | undefined =
    bPinnedItem && bPinnedItem !== 'everstone'
      ? POWER_ITEM_STAT[bPinnedItem as Exclude<ItemKey, 'everstone'>]
      : undefined;

  const alternativesForA = compatible
    .filter(
      (m) =>
        m.id !== best.candidate.parentAId &&
        m.id !== best.candidate.parentBId &&
        (aPinnedStat ? m.ivs[aPinnedStat] === 31 : m.nature === goal.nature),
    )
    .slice(0, 5)
    .map((m) => m.id);

  const alternativesForB = compatible
    .filter(
      (m) =>
        m.id !== best.candidate.parentAId &&
        m.id !== best.candidate.parentBId &&
        (bPinnedStat ? m.ivs[bPinnedStat] === 31 : m.nature === goal.nature),
    )
    .slice(0, 5)
    .map((m) => m.id);

  // 6. Build warnings
  const warnings: string[] = [...best.candidate.prediction.warnings];

  warnings.push(
    'IV inheritance is probabilistic — guaranteed stats are pinned via Power items; other stats are estimates',
  );

  // HA warning: if goal requires HA but female-role parent lacks it
  if (goal.requireHiddenAbility) {
    const validation = validatePair(best.a, best.b, getSpecies);
    const femaleRoleParent =
      validation.femaleRoleParentId === best.a.id ? best.a : best.b;
    if (!femaleRoleParent.isHiddenAbility) {
      warnings.push(
        'Hidden Ability required but the female-role parent does not have HA — HA cannot propagate from this pairing',
      );
    }
  }

  // Low-female-ratio fee warning
  const offspringSpeciesId = best.candidate.prediction.offspringSpeciesId;
  const offspringSpecies = getSpecies(offspringSpeciesId);
  if (offspringSpecies && !offspringSpecies.isGenderless && offspringSpecies.femaleRatio < 0.3) {
    warnings.push(
      `Low female ratio (${(offspringSpecies.femaleRatio * 100).toFixed(0)}%) — gender selection fees will be elevated`,
    );
  }

  return {
    pair: best.candidate,
    alternativesForA,
    alternativesForB,
    warnings,
  };
}

/**
 * Build the full plan for a breeding goal given the current pool.
 */
export function buildPlan(
  pool: OwnedPokemon[],
  goal: BreedingGoal,
  settings: Settings,
  getSpecies: (id: number) => PokemonSpecies | undefined,
): Plan {
  // Check if any pool mon already meets the goal
  const matching = pool.find((m) => goalMet(m, goal, getSpecies));
  const done = matching !== undefined;

  const gaps = identifyGaps(pool, goal, getSpecies);
  const recommendation = done ? null : recommendNextPair(pool, goal, settings, getSpecies);
  const estimate = estimateGoal(goal, settings, getSpecies);

  return {
    goal,
    done,
    matchingPokemonId: matching?.id,
    recommendation,
    estimate,
    gaps,
  };
}

/**
 * Re-planning is planning over the updated pool — alias to buildPlan.
 */
export const replan = buildPlan;

/**
 * Validate a manually chosen pair and build a PairCandidate if valid.
 */
export function validateManualPair(
  parentAId: string,
  parentBId: string,
  pool: OwnedPokemon[],
  goal: BreedingGoal,
  settings: Settings,
  getSpecies: (id: number) => PokemonSpecies | undefined,
): { validation: ValidationResult; candidate?: PairCandidate } {
  const a = pool.find((m) => m.id === parentAId);
  const b = pool.find((m) => m.id === parentBId);

  if (!a || !b) {
    const missing: string[] = [];
    if (!a) missing.push(`parentA id "${parentAId}"`);
    if (!b) missing.push(`parentB id "${parentBId}"`);
    const validation: ValidationResult = {
      valid: false,
      reasons: [`Pokémon not found in pool: ${missing.join(', ')}`],
    };
    return { validation };
  }

  const validation = validatePair(a, b, getSpecies);
  if (!validation.valid) {
    return { validation };
  }

  const candidate = buildCandidate(a, b, goal, settings, getSpecies);
  if (!candidate) {
    // buildCandidate returned null despite valid pair — shouldn't happen, but handle defensively
    const fallbackValidation: ValidationResult = {
      valid: false,
      reasons: ['Could not build candidate for this pair (internal error)'],
    };
    return { validation: fallbackValidation };
  }

  return { validation, candidate };
}
