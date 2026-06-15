import { buildPlan, validateManualPair } from '../../engine/planner';
import { buildOptimalPlan, computePlanCost } from '../../engine/optimalPlan';
import { attributeCount, baseMonsNeeded, totalBreeds } from '../../engine/pyramid';
import type { Plan, Gap } from '../../engine/planner';
import type { FullPlan, PlanNode, Attribute } from '../../engine/types';
import type { Settings, OwnedPokemon, BreedingGoal } from '../../store/types';
import type { PokemonSpecies } from '../../data/types';

type GetSpecies = (id: number) => PokemonSpecies | undefined;
type PlannerFn = (pool: OwnedPokemon[], goal: BreedingGoal, settings: Settings, getSpecies: GetSpecies) => Plan;

const STAT_LABEL: Record<string, string> = {
  hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe',
};

function describeAttr(attr: Attribute): string {
  return attr.kind === 'iv' ? `${STAT_LABEL[attr.stat]} (31 IV)` : `${attr.nature} nature`;
}

/** Find the first breed node whose both children are already owned mons (performable now). */
function firstPerformableBreed(node: PlanNode): { a: string; b: string } | null {
  if (!node.children) return null;
  const [l, r] = node.children;
  // depth-first, children before parent, so deepest-ready breed surfaces first
  return (
    firstPerformableBreed(l) ??
    firstPerformableBreed(r) ??
    (l.assignedOwnedId && r.assignedOwnedId ? { a: l.assignedOwnedId, b: r.assignedOwnedId } : null)
  );
}

function adapt(full: FullPlan, settings: Settings, pool: OwnedPokemon[], getSpecies: GetSpecies): Plan {
  const n = attributeCount(full.goal);
  const cost = computePlanCost(full, settings);
  const acquisitions = cost.total - cost.powerItems - cost.everstone - cost.abilityPill;

  const gaps: Gap[] = full.gaps.map((g) => ({
    attribute: g.attributes[0],
    description: `Acquire a Pokémon with ${g.attributes.map(describeAttr).join(' + ')}`,
  }));

  let recommendation: Plan['recommendation'] = null;
  const ready = firstPerformableBreed(full.root);
  if (ready) {
    const { candidate } = validateManualPair(ready.a, ready.b, pool, full.goal, settings, getSpecies);
    if (candidate) {
      recommendation = { pair: candidate, alternativesForA: [], alternativesForB: [], warnings: candidate.prediction.warnings };
    }
  }

  return {
    goal: full.goal,
    done: full.done,
    matchingPokemonId: full.done ? full.root.assignedOwnedId : undefined,
    recommendation,
    estimate: {
      attributeCount: n,
      baseMonsNeeded: baseMonsNeeded(n),
      totalBreeds: totalBreeds(n),
      cost,
      assumptions: [
        'Cost-optimized plan (minimum total Pokéyen for the current pool).',
        `Includes ${acquisitions.toLocaleString()} Pokéyen to acquire ${full.gaps.length} base carrier(s).`,
      ],
    },
    gaps,
  };
}

/** Choose the planner based on the costOptimizer feature toggle. */
export function selectPlanner(settings: Settings): PlannerFn {
  if (!settings.features.costOptimizer) return buildPlan;
  return (pool, goal, s, getSpecies) => adapt(buildOptimalPlan(pool, goal, s, getSpecies), s, pool, getSpecies);
}
