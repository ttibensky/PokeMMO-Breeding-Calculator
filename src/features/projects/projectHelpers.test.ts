import { describe, it, expect } from 'vitest';
import {
  targetStatKeysFromGoal,
  goalSummary,
  spentSoFar,
  breedsDone,
  progressPercent,
  formatMoney,
  formatNatureLabel,
  STAT_LABELS,
  STATUS_COLOR,
  ITEM_LABELS,
} from './projectHelpers';
import type { BreedingGoal, BreedingProject, ItemKey } from '../../store/types';

// ── helpers ────────────────────────────────────────────────────────────────────

function makeGoal(overrides: Partial<BreedingGoal> = {}): BreedingGoal {
  return {
    speciesId: 1,
    targetIVs: {},
    ...overrides,
  };
}

function makeProject(
  goalOverrides: Partial<BreedingGoal> = {},
  projectOverrides: Partial<BreedingProject> = {},
): BreedingProject {
  return {
    id: 'test-id',
    name: 'Test Project',
    goal: makeGoal(goalOverrides),
    status: 'planning',
    progress: [],
    createdAt: new Date().toISOString(),
    ...projectOverrides,
  };
}

function makeStep(costSpent: number): BreedingProject['progress'][number] {
  return {
    id: crypto.randomUUID(),
    parentAId: 'a',
    parentBId: 'b',
    heldItems: {},
    resultPokemonId: 'child',
    costSpent,
    reportedAt: new Date().toISOString(),
  };
}

// ── targetStatKeysFromGoal ─────────────────────────────────────────────────────

describe('targetStatKeysFromGoal', () => {
  it('returns only stats with value 31', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31, def: 31 } });
    expect(targetStatKeysFromGoal(goal)).toEqual(['hp', 'atk', 'def']);
  });

  it('excludes stats that are not 31', () => {
    // targetIVs only stores 31 values per the type definition, but function filters for 31
    const goal = makeGoal({ targetIVs: { hp: 31 } });
    expect(targetStatKeysFromGoal(goal)).toEqual(['hp']);
  });

  it('returns empty array when targetIVs is empty', () => {
    const goal = makeGoal({ targetIVs: {} });
    expect(targetStatKeysFromGoal(goal)).toEqual([]);
  });

  it('handles all six stats at 31', () => {
    const goal = makeGoal({
      targetIVs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    });
    const keys = targetStatKeysFromGoal(goal);
    expect(keys).toHaveLength(6);
    expect(keys).toContain('hp');
    expect(keys).toContain('spe');
  });
});

// ── goalSummary ────────────────────────────────────────────────────────────────

describe('goalSummary', () => {
  it('formats a 4-stat goal correctly', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31, def: 31, spe: 31 } });
    expect(goalSummary(goal)).toBe('4×31 HP/Atk/Def/Spe');
  });

  it('appends nature with "+ <Nature>" when nature is set', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 }, nature: 'Adamant' });
    expect(goalSummary(goal)).toBe('2×31 HP/Atk + Adamant');
  });

  it('appends ♀ glyph when gender is female', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 }, gender: 'female' });
    expect(goalSummary(goal)).toBe('2×31 HP/Atk ♀');
  });

  it('appends ♂ glyph when gender is male', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 }, gender: 'male' });
    expect(goalSummary(goal)).toBe('2×31 HP/Atk ♂');
  });

  it('appends ✦ when requireShiny is true', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 }, requireShiny: true });
    expect(goalSummary(goal)).toBe('2×31 HP/Atk ✦');
  });

  it('appends (HA) when requireHiddenAbility is true', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 }, requireHiddenAbility: true });
    expect(goalSummary(goal)).toBe('2×31 HP/Atk (HA)');
  });

  it('handles combination: nature + gender + shiny + HA', () => {
    const goal = makeGoal({
      targetIVs: { hp: 31, atk: 31, def: 31, spe: 31 },
      nature: 'Adamant',
      gender: 'female',
      requireShiny: true,
      requireHiddenAbility: true,
    });
    // Expected: "4×31 HP/Atk/Def/Spe + Adamant ♀ ✦ (HA)"
    expect(goalSummary(goal)).toBe('4×31 HP/Atk/Def/Spe + Adamant ♀ ✦ (HA)');
  });

  it('returns empty string for an empty goal', () => {
    const goal = makeGoal({ targetIVs: {} });
    expect(goalSummary(goal)).toBe('');
  });

  it('does not include gender glyph when gender is undefined', () => {
    const goal = makeGoal({ targetIVs: { hp: 31, atk: 31 } });
    const summary = goalSummary(goal);
    expect(summary).not.toContain('♀');
    expect(summary).not.toContain('♂');
  });

  it('shiny ✦ comes before (HA)', () => {
    const goal = makeGoal({
      targetIVs: { hp: 31, atk: 31 },
      requireShiny: true,
      requireHiddenAbility: true,
    });
    const summary = goalSummary(goal);
    expect(summary.indexOf('✦')).toBeLessThan(summary.indexOf('(HA)'));
  });
});

// ── spentSoFar ────────────────────────────────────────────────────────────────

describe('spentSoFar', () => {
  it('returns 0 for a project with no progress', () => {
    const project = makeProject();
    expect(spentSoFar(project)).toBe(0);
  });

  it('sums costSpent across all progress steps', () => {
    const project = makeProject({}, {
      progress: [makeStep(10000), makeStep(20000), makeStep(5000)],
    });
    expect(spentSoFar(project)).toBe(35000);
  });

  it('works with a single step', () => {
    const project = makeProject({}, { progress: [makeStep(15000)] });
    expect(spentSoFar(project)).toBe(15000);
  });
});

// ── breedsDone ────────────────────────────────────────────────────────────────

describe('breedsDone', () => {
  it('returns 0 for no progress', () => {
    expect(breedsDone(makeProject())).toBe(0);
  });

  it('returns the number of progress entries', () => {
    const project = makeProject({}, {
      progress: [makeStep(100), makeStep(200), makeStep(300)],
    });
    expect(breedsDone(project)).toBe(3);
  });
});

// ── progressPercent ────────────────────────────────────────────────────────────

describe('progressPercent', () => {
  it('returns correct percentage when totalBreeds > 0', () => {
    const project = makeProject({}, { progress: [makeStep(0), makeStep(0)] });
    expect(progressPercent(project, 4)).toBe(50);
  });

  it('returns 100 when status is done and totalBreeds is 0', () => {
    const project = makeProject({}, { status: 'done' });
    expect(progressPercent(project, 0)).toBe(100);
  });

  it('returns 0 when totalBreeds is 0 and status is not done', () => {
    const project = makeProject({}, { status: 'planning' });
    expect(progressPercent(project, 0)).toBe(0);
  });

  it('clamps to 100 (never exceeds 100)', () => {
    // More steps done than estimated totalBreeds
    const project = makeProject({}, {
      progress: [makeStep(0), makeStep(0), makeStep(0)],
    });
    expect(progressPercent(project, 2)).toBe(100);
  });

  it('clamps to 0 (never negative)', () => {
    const project = makeProject({}, { progress: [] });
    expect(progressPercent(project, 10)).toBe(0);
  });

  it('rounds to nearest integer', () => {
    // 1 of 3 = 33.33% → rounds to 33
    const project = makeProject({}, { progress: [makeStep(0)] });
    expect(progressPercent(project, 3)).toBe(33);
  });
});

// ── STAT_LABELS ────────────────────────────────────────────────────────────────

describe('STAT_LABELS', () => {
  it('has all six stat keys', () => {
    expect(STAT_LABELS).toHaveProperty('hp', 'HP');
    expect(STAT_LABELS).toHaveProperty('atk', 'Atk');
    expect(STAT_LABELS).toHaveProperty('def', 'Def');
    expect(STAT_LABELS).toHaveProperty('spa', 'SpA');
    expect(STAT_LABELS).toHaveProperty('spd', 'SpD');
    expect(STAT_LABELS).toHaveProperty('spe', 'Spe');
  });
});

// ── STATUS_COLOR ───────────────────────────────────────────────────────────────

describe('STATUS_COLOR', () => {
  it('has all four project statuses', () => {
    expect(STATUS_COLOR).toHaveProperty('planning');
    expect(STATUS_COLOR).toHaveProperty('in-progress');
    expect(STATUS_COLOR).toHaveProperty('done');
    expect(STATUS_COLOR).toHaveProperty('abandoned');
  });
});

// ── ITEM_LABELS ────────────────────────────────────────────────────────────────

describe('ITEM_LABELS', () => {
  const expectedKeys: ItemKey[] = [
    'powerWeight',
    'powerBracer',
    'powerBelt',
    'powerLens',
    'powerBand',
    'powerAnklet',
    'everstone',
  ];

  it('has all ItemKeys', () => {
    for (const key of expectedKeys) {
      expect(ITEM_LABELS).toHaveProperty(key);
      expect(typeof ITEM_LABELS[key]).toBe('string');
    }
  });

  it('has the correct label for everstone', () => {
    expect(ITEM_LABELS.everstone).toBe('Everstone');
  });

  it('has the correct label for powerWeight (HP)', () => {
    expect(ITEM_LABELS.powerWeight).toBe('Power Weight (HP)');
  });
});

// ── formatMoney ────────────────────────────────────────────────────────────────

describe('formatMoney', () => {
  it('formats 620000 as "$620,000"', () => {
    expect(formatMoney(620000)).toBe('$620,000');
  });

  it('formats 0 as "$0"', () => {
    expect(formatMoney(0)).toBe('$0');
  });

  it('formats 1000 as "$1,000"', () => {
    expect(formatMoney(1000)).toBe('$1,000');
  });

  it('formats 10000 as "$10,000"', () => {
    expect(formatMoney(10000)).toBe('$10,000');
  });

  it('formats 1000000 as "$1,000,000"', () => {
    expect(formatMoney(1000000)).toBe('$1,000,000');
  });
});

// ── formatNatureLabel ──────────────────────────────────────────────────────────

describe('formatNatureLabel', () => {
  it('formats an effect nature as "Name +Up −Down"', () => {
    expect(formatNatureLabel('Adamant')).toBe('Adamant +Atk −SpA');
  });

  it('formats another effect nature correctly', () => {
    expect(formatNatureLabel('Modest')).toBe('Modest +SpA −Atk');
  });

  it('formats a neutral nature as "Name neutral"', () => {
    expect(formatNatureLabel('Hardy')).toBe('Hardy neutral');
  });
});
