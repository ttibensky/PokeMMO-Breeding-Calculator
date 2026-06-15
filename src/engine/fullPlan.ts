import type { Attribute } from './types';

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
