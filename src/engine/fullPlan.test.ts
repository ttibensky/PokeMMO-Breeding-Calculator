import { describe, it, expect } from 'vitest';
import { buildPyramidSpec, buildFullPlan } from './fullPlan';
import { computeGuaranteedTargetStats } from './planner';
import { baseMonsNeeded } from './pyramid';
import type { OwnedPokemon, BreedingGoal, ItemKey } from '../store/types';
import type { PlanNode } from './types';
import { DEFAULT_SETTINGS } from '../store/defaults';
import type { PokemonSpecies } from '../data/types';

let _idCounter = 0;
function freshId(): string {
  return `mon-${++_idCounter}`;
}

function makeMon(overrides: Partial<OwnedPokemon> = {}): OwnedPokemon {
  return {
    id: freshId(),
    speciesId: 1,
    ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    nature: 'Hardy',
    ability: 'Overgrow',
    isHiddenAbility: false,
    gender: 'female',
    isShiny: false,
    isAlpha: false,
    eggMoves: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeGoal(overrides: Partial<BreedingGoal> = {}): BreedingGoal {
  return { speciesId: 1, targetIVs: {}, ...overrides };
}

function makeSpecies(id: number, partial: Partial<PokemonSpecies> = {}): PokemonSpecies {
  return {
    id,
    name: `Species${id}`,
    types: ['normal'],
    spriteUrl: '',
    eggGroups: ['monster'],
    genderRate: 4,
    isGenderless: false,
    femaleRatio: 0.5,
    abilities: [{ name: 'Overgrow', isHidden: false }],
    moves: [],
    ...partial,
  };
}

const SPECIES_MAP: Record<number, PokemonSpecies> = {
  1: makeSpecies(1),
  132: makeSpecies(132, { name: 'Ditto', eggGroups: ['ditto'], isGenderless: true, femaleRatio: 0 }),
};

function getSpecies(id: number): PokemonSpecies | undefined {
  return SPECIES_MAP[id];
}

describe('buildPyramidSpec', () => {
  it('returns a childless leaf for a single attribute', () => {
    const spec = buildPyramidSpec([{ kind: 'iv', stat: 'hp' }]);
    expect(spec.attributes).toHaveLength(1);
    expect(spec.children).toBeUndefined();
    expect(spec.newlyPinned).toBeUndefined();
  });

  it('returns a childless leaf for zero attributes', () => {
    const spec = buildPyramidSpec([]);
    expect(spec.attributes).toHaveLength(0);
    expect(spec.children).toBeUndefined();
  });

  it('splits a 2-attribute node into two single-attribute leaves and pins both', () => {
    const hp = { kind: 'iv', stat: 'hp' } as const;
    const atk = { kind: 'iv', stat: 'atk' } as const;
    const spec = buildPyramidSpec([hp, atk]);
    expect(spec.newlyPinned).toEqual([hp, atk]);
    expect(spec.children).toBeDefined();
    const [a, b] = spec.children!;
    expect(a.attributes).toEqual([atk]); // drop first
    expect(b.attributes).toEqual([hp]);  // drop last
  });

  it('keeps children at size k-1 sharing the middle attributes (balanced)', () => {
    const attrs = [
      { kind: 'iv', stat: 'hp' },
      { kind: 'iv', stat: 'atk' },
      { kind: 'iv', stat: 'def' },
    ] as const;
    const spec = buildPyramidSpec([...attrs]);
    const [a, b] = spec.children!;
    expect(a.attributes).toEqual([attrs[1], attrs[2]]); // drop first
    expect(b.attributes).toEqual([attrs[0], attrs[1]]); // drop last
    expect(spec.newlyPinned).toEqual([attrs[0], attrs[2]]);
  });

  it('produces 2^(N-1) leaves for N attributes', () => {
    const stats = ['hp', 'atk', 'def', 'spa', 'spe'] as const;
    const attrs = stats.map((stat) => ({ kind: 'iv' as const, stat }));
    const countLeaves = (n: { children?: unknown[] } & { attributes: unknown[] }): number =>
      n.children ? (n.children as never[]).reduce<number>((s, c) => s + countLeaves(c), 0) : 1;
    for (let n = 1; n <= 5; n++) {
      expect(countLeaves(buildPyramidSpec(attrs.slice(0, n)) as never)).toBe(baseMonsNeeded(n));
    }
  });
});

describe('buildFullPlan — assignment & gaps', () => {
  const fiveIvGoal = makeGoal({
    targetIVs: { hp: 31, atk: 31, def: 31, spa: 31, spe: 31 },
  });

  it('empty pool: every leaf is a gap, none reserved', () => {
    const plan = buildFullPlan([], fiveIvGoal, getSpecies);
    expect(plan.done).toBe(false);
    expect(plan.reservedOwnedIds).toEqual([]);
    expect(plan.gaps).toHaveLength(baseMonsNeeded(5)); // 16
    expect(plan.gaps.every((g) => g.speciesId === 1)).toBe(true);
    expect(plan.root.id).toBe('0');
  });

  it('assigns a single-attribute owned mon to a matching leaf', () => {
    const hpMon = makeMon({ ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
    const plan = buildFullPlan([hpMon], fiveIvGoal, getSpecies);
    expect(plan.reservedOwnedIds).toEqual([hpMon.id]);
    expect(plan.gaps).toHaveLength(baseMonsNeeded(5) - 1); // 15
  });

  it('slots a multi-attribute mon high and prunes its subtree', () => {
    const trio = makeMon({ ivs: { hp: 31, atk: 31, def: 31, spa: 0, spd: 0, spe: 0 } });
    const plan = buildFullPlan([trio], fiveIvGoal, getSpecies);
    expect(plan.reservedOwnedIds).toContain(trio.id);

    // The node it was assigned to carries exactly {hp,atk,def} and has no children (pruned).
    const findAssigned = (n: PlanNode): PlanNode | undefined => {
      if (n.assignedOwnedId === trio.id) return n;
      return n.children?.map(findAssigned).find(Boolean);
    };
    const node = findAssigned(plan.root)!;
    expect(node.children).toBeUndefined();
    expect(node.attributes.map((a) => (a.kind === 'iv' ? a.stat : a.nature)).sort())
      .toEqual(['atk', 'def', 'hp']);
    // Pruning removes the 3 leaves the trio replaces (a 3-attr subtree = 4 leaves -> 1 node).
    expect(plan.gaps.length).toBeLessThan(baseMonsNeeded(5));
  });

  it('minimal-surplus tie-break: the leaner mon takes the leaf, conserving the richer one', () => {
    // Goal {hp,atk,def}. monHpDef carries {hp,def}; monDef carries {def}. Both match the
    // [def] leaf. Surplus-blind id ordering would put monHpDef on [def] (smaller id), then
    // the [hp] leaf gaps because monDef has no hp. Minimal-surplus puts monDef on [def],
    // freeing monHpDef for [hp] — zero hp/def gaps.
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31, def: 31 } });
    const monHpDef = makeMon({ ivs: { hp: 31, atk: 0, def: 31, spa: 0, spd: 0, spe: 0 } });
    const monDef = makeMon({ ivs: { hp: 0, atk: 0, def: 31, spa: 0, spd: 0, spe: 0 } });
    const plan = buildFullPlan([monHpDef, monDef], goal, getSpecies); // monHpDef has the smaller id

    expect(plan.reservedOwnedIds).toContain(monDef.id);
    expect(plan.reservedOwnedIds).toContain(monHpDef.id);

    const defLeaf = (function find(n: PlanNode): PlanNode | undefined {
      if (!n.children && n.attributes.length === 1 && n.attributes[0].kind === 'iv'
          && n.attributes[0].stat === 'def' && n.assignedOwnedId) return n;
      return n.children?.map(find).find(Boolean);
    })(plan.root);
    expect(defLeaf?.assignedOwnedId).toBe(monDef.id);

    // No gap is for hp or def — both were covered by the two owned mons.
    const gapStats = plan.gaps.flatMap((g) => g.attributes.map((a) => (a.kind === 'iv' ? a.stat : a.nature)));
    expect(gapStats).not.toContain('hp');
    expect(gapStats).not.toContain('def');
  });

  it('ignores incompatible mons (wrong egg group, non-Ditto)', () => {
    const alien = makeMon({ speciesId: 1, ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
    // Goal species shares egg group with species 1, so make the mon a species not in the pool/egg group:
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 }, speciesId: 1 });
    const incompatible = makeMon({ speciesId: 999, ivs: { hp: 31, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
    const plan = buildFullPlan([incompatible], goal, getSpecies);
    expect(plan.reservedOwnedIds).not.toContain(incompatible.id);
    // sanity: a compatible same-species mon WOULD be used
    const ok = buildFullPlan([alien], goal, getSpecies);
    expect(ok.reservedOwnedIds).toContain(alien.id);
  });
});

describe('buildFullPlan — done & trivial goals', () => {
  it('done=true when an owned mon already meets the goal', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 }, speciesId: 1 });
    const finished = makeMon({ speciesId: 1, ivs: { hp: 31, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 } });
    const plan = buildFullPlan([finished], goal, getSpecies);
    expect(plan.done).toBe(true);
    expect(plan.reservedOwnedIds).toEqual([finished.id]);
    expect(plan.root.assignedOwnedId).toBe(finished.id);
    expect(plan.root.children).toBeUndefined();
    expect(plan.gaps).toEqual([]);
  });

  it('single-attribute goal: one leaf, gap when pool is empty', () => {
    const goal = makeGoal({ targetIVs: { hp: 31 }, speciesId: 1 });
    const plan = buildFullPlan([], goal, getSpecies);
    expect(plan.done).toBe(false);
    expect(plan.root.children).toBeUndefined();
    expect(plan.gaps).toHaveLength(1);
  });

  it('zero-attribute goal: single leaf', () => {
    const goal = makeGoal({ targetIVs: {}, speciesId: 1 });
    const plan = buildFullPlan([], goal, getSpecies);
    expect(plan.root.children).toBeUndefined();
    expect(plan.gaps).toHaveLength(1);
  });
});

describe('buildFullPlan — forward-predictor cross-check', () => {
  // StatKey -> Power item that pins it.
  const POWER_ITEM: Record<string, ItemKey> = {
    hp: 'powerWeight', atk: 'powerBracer', def: 'powerBelt',
    spa: 'powerLens', spd: 'powerBand', spe: 'powerAnklet',
  };

  // Build a concrete parent that carries exactly the given IV attributes at 31.
  function monFromAttrs(node: PlanNode, gender: 'male' | 'female'): OwnedPokemon {
    const ivs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    for (const a of node.attributes) {
      if (a.kind === 'iv') ivs[a.stat] = 31;
    }
    return makeMon({ speciesId: 1, gender, ivs });
  }

  it('every breed node guarantees its IV attributes via the forward predictor', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31, def: 31, spa: 31, spe: 31 } });
    const plan = buildFullPlan([], goal, getSpecies); // empty pool => full pyramid

    const visit = (n: PlanNode): void => {
      if (!n.children) return;
      const [childA, childB] = n.children; // childA dropped first, childB dropped last
      const [first, last] = n.newlyPinned!;  // first pinned on childB, last pinned on childA
      const parentA = monFromAttrs(childA, 'female'); // dropped first -> `last` is pinned here
      const parentB = monFromAttrs(childB, 'male');   // dropped last  -> `first` is pinned here
      const items: { a?: ItemKey; b?: ItemKey } = {};
      if (last.kind === 'iv') items.a = POWER_ITEM[last.stat];
      if (first.kind === 'iv') items.b = POWER_ITEM[first.stat];

      const guaranteed = computeGuaranteedTargetStats(
        parentA, parentB, items, goal, DEFAULT_SETTINGS.mechanics,
      );
      for (const a of n.attributes) {
        if (a.kind === 'iv') expect(guaranteed).toContain(a.stat);
      }
      n.children.forEach(visit);
    };

    visit(plan.root);
  });
});

describe('buildFullPlan — optimal flag', () => {
  it('sets optimal=true on the returned plan', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 } });
    const plan = buildFullPlan([], goal, getSpecies);
    expect(plan.optimal).toBe(true);
  });
});

describe('buildFullPlan — determinism', () => {
  it('produces identical trees, reservations, and gaps across repeated calls', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31, def: 31 } });
    const pool = [
      makeMon({ ivs: { hp: 31, atk: 31, def: 0, spa: 0, spd: 0, spe: 0 } }),
      makeMon({ ivs: { hp: 0, atk: 0, def: 31, spa: 0, spd: 0, spe: 0 } }),
    ];
    const a = buildFullPlan(pool, goal, getSpecies);
    const b = buildFullPlan(pool, goal, getSpecies);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('uses stable path-based node ids', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 } });
    const plan = buildFullPlan([], goal, getSpecies);
    expect(plan.root.id).toBe('0');
    expect(plan.root.children?.map((c) => c.id)).toEqual(['0.0', '0.1']);
  });
});
