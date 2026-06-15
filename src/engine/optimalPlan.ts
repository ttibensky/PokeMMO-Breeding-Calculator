import type { Attribute, CostBreakdown, FullPlan, PlanGap, PlanNode } from './types';
import type { OwnedPokemon, BreedingGoal, Settings } from '../store/types';
import type { PokemonSpecies } from '../data/types';
import { STAT_TO_POWER_ITEM, targetAttributes, carriesAttribute, isCompatible, goalMet } from './planner';
import { buildFullPlan } from './fullPlan';

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

/** Defensive bound on search-node expansions before falling back to greedy. */
export const OPTIMIZER_NODE_CAP = 200_000;

class CapExceeded extends Error {}

interface Carrier {
  id: string;
  coverage: number; // bitmask over the goal attribute array
}

// Abstract tree the search returns; rendered into PlanNodes afterwards.
type AbsNode =
  | { kind: 'owned'; ownedId: string }
  | { kind: 'gap'; attrIndex: number }
  | { kind: 'breed'; pinned: [number, number]; left: AbsNode; right: AbsNode };

function popcount(n: number): number {
  let c = 0;
  while (n) { c += n & 1; n >>>= 1; }
  return c;
}

function bitsOf(mask: number): number[] {
  const out: number[] = [];
  for (let i = 0; mask; i++, mask >>>= 1) if (mask & 1) out.push(i);
  return out;
}

export function buildOptimalPlan(
  pool: OwnedPokemon[],
  goal: BreedingGoal,
  settings: Settings,
  getSpecies: (id: number) => PokemonSpecies | undefined,
  nodeCap: number = OPTIMIZER_NODE_CAP,
): FullPlan {
  const attrs = targetAttributes(goal);

  // Short-circuit: an owned mon already satisfies the whole goal.
  const met = pool
    .filter((m) => goalMet(m, goal, getSpecies))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  if (met.length > 0) {
    return {
      goal, done: true, optimal: true,
      root: { id: '0', attributes: attrs, assignedOwnedId: met[0].id },
      reservedOwnedIds: [met[0].id], gaps: [],
    };
  }

  const n = attrs.length;
  const fullMask = (1 << n) - 1;

  // Compatible carriers with their goal-attribute coverage mask. Sorted for determinism.
  const carriers: Carrier[] = pool
    .filter((m) => isCompatible(m, goal, getSpecies))
    .map((m) => ({
      id: m.id,
      coverage: attrs.reduce((acc, a, i) => (carriesAttribute(m, a, goal) ? acc | (1 << i) : acc), 0),
    }))
    .filter((c) => c.coverage !== 0)
    .sort((a, b) => (a.id < b.id ? -1 : 1));

  let nodeCount = 0;
  const memo = new Map<string, { cost: number; node: AbsNode }>();

  const pinCost = (i: number): number => {
    const a = attrs[i];
    if (a.kind === 'iv') return settings.prices[STAT_TO_POWER_ITEM[a.stat]];
    return settings.mechanics.everstoneConsumed ? settings.prices.everstone : 0;
  };

  function solve(mask: number, avail: Carrier[]): { cost: number; node: AbsNode } {
    if (++nodeCount > nodeCap) throw new CapExceeded();
    const key = `${mask}|${avail.map((c) => c.id).join(',')}`;
    const cached = memo.get(key);
    if (cached) return cached;

    let best: { cost: number; node: AbsNode } = { cost: Infinity, node: { kind: 'gap', attrIndex: 0 } };

    // Option A: use an owned carrier that covers `mask` -> cost 0. First (sorted) is fine; see plan notes.
    const coverMon = avail.find((c) => (c.coverage & mask) === mask);
    if (coverMon) {
      best = { cost: 0, node: { kind: 'owned', ownedId: coverMon.id } };
      memo.set(key, best);
      return best; // 0 is optimal for this subtree
    }

    if (popcount(mask) === 1) {
      // Option B: acquire a base carrier.
      best = { cost: settings.prices.baseCarrier, node: { kind: 'gap', attrIndex: bitsOf(mask)[0] } };
      memo.set(key, best);
      return best;
    }

    // Option C: pick two distinct attrs to pin; children = mask minus each.
    const present = bitsOf(mask);
    const relevant = avail.filter((c) => (c.coverage & mask) !== 0);
    for (let xi = 0; xi < present.length; xi++) {
      for (let yi = 0; yi < present.length; yi++) {
        if (xi === yi) continue;
        const x = present[xi];
        const y = present[yi];
        // canonical: only consider x < y to avoid mirror duplicates (left omits x, right omits y)
        if (x > y) continue;
        const breed = pinCost(x) + pinCost(y);
        if (breed >= best.cost) continue;
        const leftMask = mask & ~(1 << x);
        const rightMask = mask & ~(1 << y);

        // Partition relevant carriers across left / right / unused, then solve each side.
        const partition = (idx: number, left: Carrier[], right: Carrier[]): void => {
          if (++nodeCount > nodeCap) throw new CapExceeded();
          if (idx === relevant.length) {
            const lr = solve(leftMask, left);
            if (breed + lr.cost >= best.cost) return;
            const rr = solve(rightMask, right);
            const total = breed + lr.cost + rr.cost;
            if (total < best.cost) {
              best = { cost: total, node: { kind: 'breed', pinned: [x, y], left: lr.node, right: rr.node } };
            }
            return;
          }
          const c = relevant[idx];
          const usefulLeft = (c.coverage & leftMask) !== 0;
          const usefulRight = (c.coverage & rightMask) !== 0;
          if (usefulLeft) partition(idx + 1, [...left, c], right);
          if (usefulRight) partition(idx + 1, left, [...right, c]);
          partition(idx + 1, left, right); // unused on this side of the split
        };
        partition(0, [], []);
      }
    }

    memo.set(key, best);
    return best;
  }

  let abs: AbsNode;
  try {
    abs = solve(fullMask, carriers).node;
  } catch (e) {
    if (e instanceof CapExceeded) {
      const fallback = buildFullPlan(pool, goal, getSpecies);
      return { ...fallback, optimal: false };
    }
    throw e;
  }

  // Render the abstract tree into a PlanNode tree, collecting gaps + reserved ids.
  const gaps: PlanGap[] = [];
  const reserved = new Set<string>();
  const maskToAttrs = (mask: number) => bitsOf(mask).map((i) => attrs[i]);

  const render = (node: AbsNode, mask: number, path: string): PlanNode => {
    if (node.kind === 'owned') {
      reserved.add(node.ownedId);
      return { id: path, attributes: maskToAttrs(mask), assignedOwnedId: node.ownedId };
    }
    if (node.kind === 'gap') {
      const a = attrs[node.attrIndex];
      gaps.push({ nodeId: path, attributes: [a], speciesId: goal.speciesId });
      return { id: path, attributes: [a] };
    }
    const [x, y] = node.pinned;
    const leftMask = mask & ~(1 << x);
    const rightMask = mask & ~(1 << y);
    return {
      id: path,
      attributes: maskToAttrs(mask),
      newlyPinned: [attrs[x], attrs[y]],
      children: [render(node.left, leftMask, `${path}.0`), render(node.right, rightMask, `${path}.1`)],
    };
  };

  const root = render(abs, fullMask, '0');
  return {
    goal, done: false, optimal: true,
    root,
    reservedOwnedIds: [...reserved].sort(),
    gaps,
  };
}
