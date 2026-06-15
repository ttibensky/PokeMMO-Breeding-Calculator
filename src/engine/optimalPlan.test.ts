import { describe, it, expect } from 'vitest';
import { computePlanCost } from './optimalPlan';
import type { FullPlan, PlanNode, Attribute } from './types';
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

import { buildOptimalPlan } from './optimalPlan';
import type { OwnedPokemon } from '../store/types';
import type { PokemonSpecies } from '../data/types';

function getSpecies(id: number): PokemonSpecies | undefined {
  if (id !== 1) return undefined;
  return {
    id: 1, name: 'S1', types: ['normal'], spriteUrl: '',
    eggGroups: ['monster'], genderRate: 4, isGenderless: false,
    femaleRatio: 0.5, abilities: ['Overgrow'], moves: [],
  } as unknown as PokemonSpecies;
}

let seq = 0;
function mon(ivs: Partial<OwnedPokemon['ivs']>, id?: string): OwnedPokemon {
  return {
    id: id ?? `m${seq++}`,
    speciesId: 1,
    ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...ivs },
    nature: 'Hardy', ability: 'Overgrow', isHiddenAbility: false,
    gender: 'female', isShiny: false, isAlpha: false,
    eggMoves: [], createdAt: '2024-01-01T00:00:00.000Z',
  };
}

describe('buildOptimalPlan', () => {
  it('done=true when an owned mon already meets the goal', () => {
    const g = goal({ hp: 31, atk: 31 });
    const m = mon({ hp: 31, atk: 31 }, 'done1');
    const plan = buildOptimalPlan([m], g, S, getSpecies);
    expect(plan.done).toBe(true);
    expect(plan.optimal).toBe(true);
    expect(plan.gaps).toEqual([]);
    expect(plan.reservedOwnedIds).toEqual(['done1']);
  });

  it('empty pool, 2 IVs: 2 gap leaves, cost 40000', () => {
    const g = goal({ hp: 31, atk: 31 });
    const plan = buildOptimalPlan([], g, S, getSpecies);
    expect(plan.done).toBe(false);
    expect(plan.gaps).toHaveLength(2);
    expect(plan.optimal).toBe(true);
    expect(computePlanCost(plan, S).total).toBe(40000);
  });

  it('empty pool, 3 IVs: 4 gap leaves, 3 breeds, cost 100000', () => {
    const g = goal({ hp: 31, atk: 31, def: 31 });
    const plan = buildOptimalPlan([], g, S, getSpecies);
    expect(plan.gaps).toHaveLength(4); // 2^(3-1)
    expect(computePlanCost(plan, S).total).toBe(100000); // 3 breeds*20000 + 4 carriers*10000
  });

  it('owned 2-IV carrier collapses its subtree (3-IV goal): fewer gaps, lower cost', () => {
    const g = goal({ hp: 31, atk: 31, def: 31 });
    const m = mon({ hp: 31, atk: 31 }, 'hpatk');
    const plan = buildOptimalPlan([m], g, S, getSpecies);
    expect(plan.reservedOwnedIds).toContain('hpatk');
    expect(plan.gaps).toHaveLength(2);          // only the non-collapsed subtree's leaves
    expect(computePlanCost(plan, S).total).toBe(60000); // 2 breeds*20000 + 2 carriers*10000
  });

  it('prefers slotting the higher-coverage owned mon when two overlap', () => {
    const g = goal({ hp: 31, atk: 31 });
    const big = mon({ hp: 31, atk: 31 }, 'big');   // covers the whole goal -> done, actually
    const small = mon({ hp: 31 }, 'small');
    const plan = buildOptimalPlan([big, small], g, S, getSpecies);
    // big meets the goal outright -> done
    expect(plan.done).toBe(true);
    expect(plan.reservedOwnedIds).toEqual(['big']);
  });

  it('owned single-IV carrier fills one leaf (2-IV goal), cost 30000', () => {
    const g = goal({ hp: 31, atk: 31 });
    const m = mon({ hp: 31 }, 'hp1');
    const plan = buildOptimalPlan([m], g, S, getSpecies);
    expect(plan.reservedOwnedIds).toContain('hp1');
    expect(plan.gaps).toHaveLength(1);
    expect(computePlanCost(plan, S).total).toBe(30000); // 1 breed 20000 + 1 carrier 10000
  });

  it('produces a structurally valid breeding tree (children = parent minus one pinned attr each)', () => {
    const g = goal({ hp: 31, atk: 31, def: 31 });
    const plan = buildOptimalPlan([], g, S, getSpecies);
    const key = (a: Attribute) => (a.kind === 'iv' ? `iv:${a.stat}` : `nat`);
    const check = (node: PlanNode): void => {
      if (!node.children) return;
      const [pa, pb] = node.newlyPinned!;
      const parent = new Set(node.attributes.map(key));
      const left = new Set(node.children[0].attributes.map(key));
      const right = new Set(node.children[1].attributes.map(key));
      // each child is the parent set minus exactly one pinned attribute
      expect([...parent].filter((k) => !left.has(k))).toEqual([key(pa)]);
      expect([...parent].filter((k) => !right.has(k))).toEqual([key(pb)]);
      check(node.children[0]);
      check(node.children[1]);
    };
    check(plan.root);
  });

  it('is deterministic across calls', () => {
    const g = goal({ hp: 31, atk: 31, def: 31 });
    const pool = [mon({ hp: 31, atk: 31 }, 'fixed')];
    const a = buildOptimalPlan(pool, g, S, getSpecies);
    const b = buildOptimalPlan(pool, g, S, getSpecies);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('assigns deterministic path ids on the tree', () => {
    const g = goal({ hp: 31, atk: 31 });
    const plan = buildOptimalPlan([], g, S, getSpecies);
    expect(plan.root.id).toBe('0');
    expect(plan.root.children![0].id).toBe('0.0');
    expect(plan.root.children![1].id).toBe('0.1');
  });
});
