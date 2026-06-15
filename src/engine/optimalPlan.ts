import type { Attribute, CostBreakdown, FullPlan, PlanNode } from './types';
import type { Settings } from '../store/types';
import { STAT_TO_POWER_ITEM } from './planner';

/** Price of pinning a single attribute at one breed step. */
function pinPrice(attr: Attribute, settings: Settings): { powerItems: number; everstone: number } {
  if (attr.kind === 'iv') {
    return { powerItems: settings.prices[STAT_TO_POWER_ITEM[attr.stat]], everstone: 0 };
  }
  // nature: only costs an everstone when everstones are consumed per breed
  return { powerItems: 0, everstone: settings.mechanics.everstoneConsumed ? settings.prices.everstone : 0 };
}

/**
 * Walk a FullPlan tree and total its cost: power items + everstones across breed nodes,
 * base-carrier acquisitions for gap leaves, and one ability pill if the goal needs an ability.
 * Gender fees and Ditto are modeled as 0 (deterministic tree cost — see plan cost model).
 */
export function computePlanCost(plan: FullPlan, settings: Settings): CostBreakdown {
  let powerItems = 0;
  let everstone = 0;

  const walk = (node: PlanNode): void => {
    if (node.children) {
      for (const attr of node.newlyPinned ?? []) {
        const p = pinPrice(attr, settings);
        powerItems += p.powerItems;
        everstone += p.everstone;
      }
      walk(node.children[0]);
      walk(node.children[1]);
    }
  };
  walk(plan.root);

  const acquisitions = plan.gaps.length * settings.prices.baseCarrier;
  const abilityPill = plan.goal.ability ? settings.prices.abilityPill : 0;
  const total = powerItems + everstone + acquisitions + abilityPill;

  return { powerItems, everstone, genderFees: 0, abilityPill, ditto: 0, total };
}
