import { describe, it, expect } from 'vitest';
import { computePlanCost } from './optimalPlan';
import type { FullPlan, PlanNode } from './types';
import type { Settings, BreedingGoal } from '../store/types';
import { DEFAULT_SETTINGS } from '../store/defaults';

const S: Settings = DEFAULT_SETTINGS; // power items 10000, everstone 15000, baseCarrier 10000

function goal(targetIVs: BreedingGoal['targetIVs'], extra: Partial<BreedingGoal> = {}): BreedingGoal {
  return { speciesId: 1, targetIVs, ...extra };
}

const HP = { kind: 'iv', stat: 'hp' } as const;
const ATK = { kind: 'iv', stat: 'atk' } as const;

// A single breed of {hp,atk} from two acquired single-IV carriers.
function twoIvPlan(): FullPlan {
  const root: PlanNode = {
    id: '0',
    attributes: [HP, ATK],
    newlyPinned: [HP, ATK],
    children: [
      { id: '0.0', attributes: [HP] },
      { id: '0.1', attributes: [ATK] },
    ],
  };
  return {
    goal: goal({ hp: 31, atk: 31 }),
    done: false,
    root,
    reservedOwnedIds: [],
    gaps: [
      { nodeId: '0.0', attributes: [HP], speciesId: 1 },
      { nodeId: '0.1', attributes: [ATK], speciesId: 1 },
    ],
    optimal: true,
  };
}

describe('computePlanCost', () => {
  it('sums power items (one per pinned IV) and base-carrier acquisitions', () => {
    // 1 breed pinning hp+atk = 2 power items = 20000; 2 gap leaves = 2*10000 = 20000.
    const cost = computePlanCost(twoIvPlan(), S);
    expect(cost.powerItems).toBe(20000);
    expect(cost.everstone).toBe(0);
    expect(cost.abilityPill).toBe(0);
    expect(cost.total).toBe(40000);
  });

  it('charges everstone per nature-pinning breed when everstoneConsumed is true', () => {
    const NAT = { kind: 'nature', nature: 'Adamant' } as const;
    const root: PlanNode = {
      id: '0',
      attributes: [HP, NAT],
      newlyPinned: [HP, NAT],
      children: [
        { id: '0.0', attributes: [HP] },
        { id: '0.1', attributes: [NAT] },
      ],
    };
    const plan: FullPlan = {
      goal: goal({ hp: 31 }, { nature: 'Adamant' }),
      done: false, root, reservedOwnedIds: [],
      gaps: [
        { nodeId: '0.0', attributes: [HP], speciesId: 1 },
        { nodeId: '0.1', attributes: [NAT], speciesId: 1 },
      ],
      optimal: true,
    };
    // power item (hp) 10000 + everstone 15000 + 2 base carriers 20000 = 45000
    const cost = computePlanCost(plan, S);
    expect(cost.powerItems).toBe(10000);
    expect(cost.everstone).toBe(15000);
    expect(cost.total).toBe(45000);
  });

  it('adds the ability pill once when the goal requires an ability', () => {
    const plan = { ...twoIvPlan(), goal: goal({ hp: 31, atk: 31 }, { ability: 'Overgrow' }) };
    const cost = computePlanCost(plan, S);
    expect(cost.abilityPill).toBe(35000);
    expect(cost.total).toBe(40000 + 35000);
  });

  it('counts owned-carrier leaves as free (no acquisition cost)', () => {
    const plan = twoIvPlan();
    // Mark the first leaf as owned -> one fewer acquisition.
    plan.root.children![0] = { id: '0.0', attributes: [HP], assignedOwnedId: 'm1' };
    plan.gaps = [{ nodeId: '0.1', attributes: [ATK], speciesId: 1 }];
    const cost = computePlanCost(plan, S);
    // 2 power items (20000) + 1 base carrier (10000) = 30000
    expect(cost.total).toBe(30000);
  });
});
