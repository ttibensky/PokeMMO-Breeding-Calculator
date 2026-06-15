import type { Attribute, FullPlan, PlanNode, PlanGap } from './types';
import type { OwnedPokemon, BreedingGoal } from '../store/types';
import type { PokemonSpecies } from '../data/types';
import { targetAttributes, carriesAttribute, isCompatible, goalMet } from './planner';

export interface SpecNode {
  attributes: Attribute[];
  newlyPinned?: [Attribute, Attribute];
  children?: [SpecNode, SpecNode];
}

/**
 * Canonical top-down breeding pyramid for an attribute set.
 * A node guaranteeing `attributes` (size k >= 2) splits into:
 *   childA = attributes without the FIRST  (carries `last`,  lacks `first`)
 *   childB = attributes without the LAST   (carries `first`, lacks `last`)
 * The shared middle attributes are guaranteed free (both parents 31); the
 * dropped first/last are each pinned by one held item on the parent that has it.
 */
export function buildPyramidSpec(attributes: Attribute[]): SpecNode {
  if (attributes.length <= 1) {
    return { attributes };
  }
  const first = attributes[0];
  const last = attributes[attributes.length - 1];
  const childA = buildPyramidSpec(attributes.slice(1));
  const childB = buildPyramidSpec(attributes.slice(0, -1));
  return { attributes, newlyPinned: [first, last], children: [childA, childB] };
}

function carriesAll(mon: OwnedPokemon, attrs: Attribute[], goal: BreedingGoal): boolean {
  return attrs.every((a) => carriesAttribute(mon, a, goal));
}

function carriedCount(mon: OwnedPokemon, allAttrs: Attribute[], goal: BreedingGoal): number {
  return allAttrs.filter((a) => carriesAttribute(mon, a, goal)).length;
}

interface FlatNode {
  spec: SpecNode;
  path: string;
}

function flatten(spec: SpecNode, path: string, out: FlatNode[]): void {
  out.push({ spec, path });
  if (spec.children) {
    flatten(spec.children[0], `${path}.0`, out);
    flatten(spec.children[1], `${path}.1`, out);
  }
}

function isDescendant(path: string, ancestor: string): boolean {
  return path.startsWith(`${ancestor}.`);
}

export function buildFullPlan(
  pool: OwnedPokemon[],
  goal: BreedingGoal,
  getSpecies: (id: number) => PokemonSpecies | undefined,
): FullPlan {
  const attrs = targetAttributes(goal);
  const met = pool
    .filter((m) => goalMet(m, goal, getSpecies))
    .sort((x, y) => (x.id < y.id ? -1 : 1));
  if (met.length > 0) {
    const chosen = met[0];
    return {
      goal,
      done: true,
      root: { id: '0', attributes: attrs, assignedOwnedId: chosen.id },
      reservedOwnedIds: [chosen.id],
      gaps: [],
    };
  }
  const spec = buildPyramidSpec(attrs);
  const available = pool.filter((m) => isCompatible(m, goal, getSpecies));

  // Pass 1: assign owned mons to the LARGEST node each can fill (slot-high), then prune.
  const nodes: FlatNode[] = [];
  flatten(spec, '0', nodes);
  nodes.sort(
    (a, b) =>
      b.spec.attributes.length - a.spec.attributes.length ||
      (a.path < b.path ? -1 : 1),
  );

  const assignment = new Map<string, string>(); // node path -> owned id
  const used = new Set<string>();
  const pruned = new Set<string>();

  for (const { spec: node, path } of nodes) {
    if (pruned.has(path)) continue;
    const chosen = available
      .filter((m) => !used.has(m.id) && carriesAll(m, node.attributes, goal))
      .sort((x, y) => {
        const cx = carriedCount(x, attrs, goal);
        const cy = carriedCount(y, attrs, goal);
        if (cx !== cy) return cx - cy; // fewest surplus attributes first
        return x.id < y.id ? -1 : 1;   // deterministic tie-break
      })[0];
    if (chosen) {
      assignment.set(path, chosen.id);
      used.add(chosen.id);
      for (const n of nodes) {
        if (isDescendant(n.path, path)) pruned.add(n.path);
      }
    }
  }

  // Pass 2: render the plan tree; unmatched leaves become gaps.
  const gaps: PlanGap[] = [];
  const render = (node: SpecNode, path: string): PlanNode => {
    const assignedOwnedId = assignment.get(path);
    if (assignedOwnedId) {
      return { id: path, attributes: node.attributes, assignedOwnedId };
    }
    if (!node.children) {
      gaps.push({ nodeId: path, attributes: node.attributes, speciesId: goal.speciesId });
      return { id: path, attributes: node.attributes };
    }
    return {
      id: path,
      attributes: node.attributes,
      newlyPinned: node.newlyPinned,
      children: [render(node.children[0], `${path}.0`), render(node.children[1], `${path}.1`)],
    };
  };
  const root = render(spec, '0');

  return { goal, done: false, root, reservedOwnedIds: [...used].sort(), gaps };
}
