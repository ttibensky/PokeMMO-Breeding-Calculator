import type { StatKey } from '../data/types';
import type { BreedingGoal } from '../store/types';

export type Attribute =
  | { kind: 'iv'; stat: StatKey }
  | { kind: 'nature'; nature: string };

export interface ValidationResult {
  valid: boolean;
  reasons: string[];               // human-readable reasons it's INVALID (empty when valid)
  offspringSpeciesId?: number;     // female-role parent's species (non-Ditto in a Ditto pairing)
  femaleRoleParentId?: string;     // the parent whose species/ability the child inherits
}

export interface StatOutcome {
  value: number;
  p: number;   // probability in [0,1]
}

export interface StatDistribution {
  outcomes: StatOutcome[];
  pinned: boolean;   // true when a Power item forces this stat to a single value
}

export interface OffspringPrediction {
  offspringSpeciesId: number;
  ivs: Record<StatKey, StatDistribution>;
  /** Present if an Everstone carries a nature */
  nature?: { value: string; chance: number };
  ability?: { value: string; chance: number; isHidden: boolean };
  /** Guaranteed-shiny child when both parents are shiny */
  isShiny: boolean;
  /** True only when both parents are Alpha */
  isAlpha: boolean;
  /** Moves a parent knows AND the child species can learn */
  possibleEggMoves: string[];
  warnings: string[];
}

export interface CostBreakdown {
  powerItems: number;
  everstone: number;
  genderFees: number;
  abilityPill: number;
  ditto: number;
  total: number;
}

export interface GoalEstimate {
  attributeCount: number;
  baseMonsNeeded: number;
  totalBreeds: number;
  cost: CostBreakdown;
  assumptions: string[];
}

/** A node in a full breeding plan tree. */
export interface PlanNode {
  id: string;                                  // stable, derived from tree path ('0', '0.0', '0.1', ...)
  attributes: Attribute[];                     // what this node guarantees
  assignedOwnedId?: string;                    // set iff a current owned mon fills this node (then no children)
  newlyPinned?: [Attribute, Attribute];        // the two attributes this breed pins (breed nodes only)
  children?: [PlanNode, PlanNode];             // present iff this is a breed step
}

/** A leaf needing acquisition (no owned mon carries it). */
export interface PlanGap {
  nodeId: string;
  attributes: Attribute[];
  speciesId: number;                           // a breeding-compatible species to look for
}

/** Complete forward breeding plan for one goal over the current pool. */
export interface FullPlan {
  goal: BreedingGoal;
  done: boolean;                               // an owned mon already meets the goal
  root: PlanNode;
  reservedOwnedIds: string[];                  // current owned mons this plan consumes
  gaps: PlanGap[];
  optimal: boolean;                            // true = provably optimal; false = greedy fallback
}
