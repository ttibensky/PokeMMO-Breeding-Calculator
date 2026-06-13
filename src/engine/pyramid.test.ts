import { describe, it, expect } from 'vitest';
import { attributeCount, baseMonsNeeded, totalBreeds, PYRAMID_TABLE } from './pyramid';
import type { BreedingGoal } from '../store/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGoal(overrides?: Partial<BreedingGoal>): BreedingGoal {
  return {
    speciesId: 1,
    targetIVs: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// attributeCount
// ---------------------------------------------------------------------------

describe('attributeCount', () => {
  it('2×31 stats, no nature → 2', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 } });
    expect(attributeCount(goal)).toBe(2);
  });

  it('5×31 stats, no nature → 5', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31 } });
    expect(attributeCount(goal)).toBe(5);
  });

  it('5×31 stats + nature → 6', () => {
    const goal = makeGoal({
      targetIVs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31 },
      nature: 'Adamant',
    });
    expect(attributeCount(goal)).toBe(6);
  });

  it('6×31 stats, no nature → 6', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 } });
    expect(attributeCount(goal)).toBe(6);
  });

  it('1×31 stat, no nature → 1', () => {
    const goal = makeGoal({ targetIVs: { hp: 31 } });
    expect(attributeCount(goal)).toBe(1);
  });

  it('no stats + nature → 1 (nature counts)', () => {
    const goal = makeGoal({ targetIVs: {}, nature: 'Jolly' });
    expect(attributeCount(goal)).toBe(1);
  });

  it('no stats, no nature → 0', () => {
    const goal = makeGoal({ targetIVs: {} });
    expect(attributeCount(goal)).toBe(0);
  });

  it('ability and gender are not counted', () => {
    const goal = makeGoal({ targetIVs: { hp: 31 }, ability: 'Overgrow', gender: 'female' });
    expect(attributeCount(goal)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// baseMonsNeeded
// ---------------------------------------------------------------------------

describe('baseMonsNeeded', () => {
  it('0 attributes → 0 base mons', () => {
    expect(baseMonsNeeded(0)).toBe(0);
  });

  it('1 attribute → 1 base mon', () => {
    expect(baseMonsNeeded(1)).toBe(1);
  });

  it('2 attributes → 2 base mons', () => {
    expect(baseMonsNeeded(2)).toBe(2);
  });

  it('3 attributes → 4 base mons', () => {
    expect(baseMonsNeeded(3)).toBe(4);
  });

  it('4 attributes → 8 base mons', () => {
    expect(baseMonsNeeded(4)).toBe(8);
  });

  it('5 attributes → 16 base mons', () => {
    expect(baseMonsNeeded(5)).toBe(16);
  });

  it('6 attributes → 32 base mons', () => {
    expect(baseMonsNeeded(6)).toBe(32);
  });

  it('negative attributes → 0 base mons', () => {
    expect(baseMonsNeeded(-1)).toBe(0);
  });

  it('formula: 2^(n-1) for n in 1..6', () => {
    for (let n = 1; n <= 6; n++) {
      expect(baseMonsNeeded(n)).toBe(Math.pow(2, n - 1));
    }
  });
});

// ---------------------------------------------------------------------------
// totalBreeds
// ---------------------------------------------------------------------------

describe('totalBreeds', () => {
  it('0 attributes → 0 breeds', () => {
    expect(totalBreeds(0)).toBe(0);
  });

  it('1 attribute → 0 breeds', () => {
    expect(totalBreeds(1)).toBe(0);
  });

  it('2 attributes → 1 breed', () => {
    expect(totalBreeds(2)).toBe(1);
  });

  it('3 attributes → 3 breeds', () => {
    expect(totalBreeds(3)).toBe(3);
  });

  it('4 attributes → 7 breeds', () => {
    expect(totalBreeds(4)).toBe(7);
  });

  it('5 attributes → 15 breeds', () => {
    expect(totalBreeds(5)).toBe(15);
  });

  it('6 attributes → 31 breeds', () => {
    expect(totalBreeds(6)).toBe(31);
  });

  it('negative attributes → 0 breeds', () => {
    expect(totalBreeds(-1)).toBe(0);
  });

  it('formula: 2^(n-1)-1 for n in 1..6', () => {
    for (let n = 1; n <= 6; n++) {
      expect(totalBreeds(n)).toBe(Math.pow(2, n - 1) - 1);
    }
  });
});

// ---------------------------------------------------------------------------
// PYRAMID_TABLE
// ---------------------------------------------------------------------------

describe('PYRAMID_TABLE', () => {
  it('has entries for keys 1..6', () => {
    for (let n = 1; n <= 6; n++) {
      expect(PYRAMID_TABLE[n]).toBeDefined();
    }
  });

  it.each([
    [1, { baseMons: 1,  totalBreeds: 0  }],
    [2, { baseMons: 2,  totalBreeds: 1  }],
    [3, { baseMons: 4,  totalBreeds: 3  }],
    [4, { baseMons: 8,  totalBreeds: 7  }],
    [5, { baseMons: 16, totalBreeds: 15 }],
    [6, { baseMons: 32, totalBreeds: 31 }],
  ] as const)('PYRAMID_TABLE[%i] deep-equals mechanics §6 table', (n, expected) => {
    expect(PYRAMID_TABLE[n]).toEqual(expected);
  });

  it('PYRAMID_TABLE entries match baseMonsNeeded and totalBreeds functions', () => {
    for (let n = 1; n <= 6; n++) {
      expect(PYRAMID_TABLE[n].baseMons).toBe(baseMonsNeeded(n));
      expect(PYRAMID_TABLE[n].totalBreeds).toBe(totalBreeds(n));
    }
  });
});
