import { describe, it, expect, beforeEach } from 'vitest';
import {
  useBreedingStore,
  resetStore,
  migrate,
  DEFAULT_SETTINGS,
} from './index';
import type { OwnedPokemon, BreedingGoal } from './index';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const baseIVs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

function makePokemonInput(overrides?: Partial<Omit<OwnedPokemon, 'id' | 'createdAt'>>): Omit<OwnedPokemon, 'id' | 'createdAt'> {
  return {
    speciesId: 1,
    ivs: { ...baseIVs },
    nature: 'Adamant',
    ability: 'Overgrow',
    isHiddenAbility: false,
    gender: 'male',
    isShiny: false,
    isAlpha: false,
    eggMoves: [],
    ...overrides,
  };
}

function makeGoal(overrides?: Partial<BreedingGoal>): BreedingGoal {
  return {
    speciesId: 1,
    targetIVs: { hp: 31, atk: 31 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  resetStore();
});

// ---------------------------------------------------------------------------
// OWNED SLICE
// ---------------------------------------------------------------------------

describe('ownedSlice', () => {
  describe('addOwnedPokemon', () => {
    it('returns a non-empty string id', () => {
      const id = useBreedingStore.getState().addOwnedPokemon(makePokemonInput());
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('stores the new pokemon in ownedPokemon', () => {
      const id = useBreedingStore.getState().addOwnedPokemon(makePokemonInput());
      const { ownedPokemon } = useBreedingStore.getState();
      expect(ownedPokemon).toHaveLength(1);
      expect(ownedPokemon[0].id).toBe(id);
    });

    it('generates a unique id and ISO createdAt', () => {
      const id = useBreedingStore.getState().addOwnedPokemon(makePokemonInput());
      const mon = useBreedingStore.getState().ownedPokemon[0];
      expect(mon.id).toBe(id);
      expect(() => new Date(mon.createdAt)).not.toThrow();
      expect(new Date(mon.createdAt).toISOString()).toBe(mon.createdAt);
    });

    it('preserves all input fields', () => {
      const input = makePokemonInput({ nature: 'Jolly', isShiny: true, eggMoves: ['Tackle'], notes: 'test' });
      useBreedingStore.getState().addOwnedPokemon(input);
      const mon = useBreedingStore.getState().ownedPokemon[0];
      expect(mon.nature).toBe('Jolly');
      expect(mon.isShiny).toBe(true);
      expect(mon.eggMoves).toEqual(['Tackle']);
      expect(mon.notes).toBe('test');
    });

    it('adding two pokemon yields distinct ids', () => {
      const id1 = useBreedingStore.getState().addOwnedPokemon(makePokemonInput());
      const id2 = useBreedingStore.getState().addOwnedPokemon(makePokemonInput({ speciesId: 2 }));
      expect(id1).not.toBe(id2);
      expect(useBreedingStore.getState().ownedPokemon).toHaveLength(2);
    });
  });

  describe('getOwnedById', () => {
    it('returns the mon for a known id', () => {
      const id = useBreedingStore.getState().addOwnedPokemon(makePokemonInput());
      const mon = useBreedingStore.getState().getOwnedById(id);
      expect(mon).toBeDefined();
      expect(mon!.id).toBe(id);
    });

    it('returns undefined for an unknown id', () => {
      useBreedingStore.getState().addOwnedPokemon(makePokemonInput());
      const result = useBreedingStore.getState().getOwnedById('nonexistent-id');
      expect(result).toBeUndefined();
    });
  });

  describe('updateOwnedPokemon', () => {
    it('merges a patch without dropping other fields', () => {
      const id = useBreedingStore.getState().addOwnedPokemon(makePokemonInput({ nature: 'Adamant' }));
      useBreedingStore.getState().updateOwnedPokemon(id, { nature: 'Jolly', ivs: { ...baseIVs, atk: 0 } });
      const mon = useBreedingStore.getState().getOwnedById(id)!;
      expect(mon.nature).toBe('Jolly');
      expect(mon.ivs.atk).toBe(0);
      // other fields preserved
      expect(mon.speciesId).toBe(1);
      expect(mon.ability).toBe('Overgrow');
      expect(mon.id).toBe(id);
    });

    it('updating an unknown id is a no-op and does not throw', () => {
      const id = useBreedingStore.getState().addOwnedPokemon(makePokemonInput());
      expect(() => {
        useBreedingStore.getState().updateOwnedPokemon('bad-id', { nature: 'Timid' });
      }).not.toThrow();
      // Original mon unchanged
      const mon = useBreedingStore.getState().getOwnedById(id)!;
      expect(mon.nature).toBe('Adamant');
    });
  });

  describe('removeOwnedPokemon', () => {
    it('removes only the targeted mon', () => {
      const id1 = useBreedingStore.getState().addOwnedPokemon(makePokemonInput({ speciesId: 1 }));
      const id2 = useBreedingStore.getState().addOwnedPokemon(makePokemonInput({ speciesId: 2 }));
      useBreedingStore.getState().removeOwnedPokemon(id1);
      const { ownedPokemon } = useBreedingStore.getState();
      expect(ownedPokemon).toHaveLength(1);
      expect(ownedPokemon[0].id).toBe(id2);
    });
  });
});

// ---------------------------------------------------------------------------
// PROJECTS SLICE
// ---------------------------------------------------------------------------

describe('projectsSlice', () => {
  describe('addProject', () => {
    it('returns a non-empty string id', () => {
      const id = useBreedingStore.getState().addProject({ name: 'Test', goal: makeGoal() });
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('stores the project with default status planning and empty progress', () => {
      const id = useBreedingStore.getState().addProject({ name: 'Test', goal: makeGoal() });
      const project = useBreedingStore.getState().getProjectById(id)!;
      expect(project).toBeDefined();
      expect(project.status).toBe('planning');
      expect(project.progress).toEqual([]);
    });

    it('generates id and ISO createdAt', () => {
      const id = useBreedingStore.getState().addProject({ name: 'Test', goal: makeGoal() });
      const project = useBreedingStore.getState().getProjectById(id)!;
      expect(project.id).toBe(id);
      expect(new Date(project.createdAt).toISOString()).toBe(project.createdAt);
    });

    it('honors an explicit status argument', () => {
      const id = useBreedingStore.getState().addProject({ name: 'Done', goal: makeGoal(), status: 'done' });
      expect(useBreedingStore.getState().getProjectById(id)!.status).toBe('done');
    });
  });

  describe('getProjectById', () => {
    it('returns the project for a known id', () => {
      const id = useBreedingStore.getState().addProject({ name: 'P', goal: makeGoal() });
      const project = useBreedingStore.getState().getProjectById(id);
      expect(project).toBeDefined();
      expect(project!.id).toBe(id);
    });

    it('returns undefined for an unknown id', () => {
      useBreedingStore.getState().addProject({ name: 'P', goal: makeGoal() });
      expect(useBreedingStore.getState().getProjectById('no-such-id')).toBeUndefined();
    });
  });

  describe('updateProject', () => {
    it('merges a patch without dropping other fields', () => {
      const id = useBreedingStore.getState().addProject({ name: 'Old', goal: makeGoal() });
      useBreedingStore.getState().updateProject(id, { name: 'New' });
      const project = useBreedingStore.getState().getProjectById(id)!;
      expect(project.name).toBe('New');
      // Other fields preserved
      expect(project.goal).toEqual(makeGoal());
      expect(project.status).toBe('planning');
    });

    it('updating an unknown id is a no-op', () => {
      const id = useBreedingStore.getState().addProject({ name: 'P', goal: makeGoal() });
      expect(() => {
        useBreedingStore.getState().updateProject('bad-id', { name: 'Changed' });
      }).not.toThrow();
      expect(useBreedingStore.getState().getProjectById(id)!.name).toBe('P');
    });
  });

  describe('removeProject', () => {
    it('removes the targeted project', () => {
      const id1 = useBreedingStore.getState().addProject({ name: 'A', goal: makeGoal() });
      const id2 = useBreedingStore.getState().addProject({ name: 'B', goal: makeGoal() });
      useBreedingStore.getState().removeProject(id1);
      const { projects } = useBreedingStore.getState();
      expect(projects).toHaveLength(1);
      expect(projects[0].id).toBe(id2);
    });
  });

  describe('setProjectStatus', () => {
    it.each([
      ['planning' as const],
      ['in-progress' as const],
      ['done' as const],
      ['abandoned' as const],
    ])('sets status to %s', (status) => {
      const id = useBreedingStore.getState().addProject({ name: 'P', goal: makeGoal() });
      useBreedingStore.getState().setProjectStatus(id, status);
      expect(useBreedingStore.getState().getProjectById(id)!.status).toBe(status);
    });

    it('changes only the status, not other fields', () => {
      const id = useBreedingStore.getState().addProject({ name: 'P', goal: makeGoal() });
      useBreedingStore.getState().setProjectStatus(id, 'done');
      const project = useBreedingStore.getState().getProjectById(id)!;
      expect(project.name).toBe('P');
      expect(project.goal).toEqual(makeGoal());
    });
  });

  describe('addBreedStepResult', () => {
    it('appends a step to the correct project with generated id and ISO reportedAt', () => {
      const projectId = useBreedingStore.getState().addProject({ name: 'P', goal: makeGoal() });
      const stepInput = {
        parentAId: 'mon-a',
        parentBId: 'mon-b',
        heldItems: { a: 'powerWeight' as const },
        resultPokemonId: 'mon-result',
        costSpent: 10000,
      };
      const stepId = useBreedingStore.getState().addBreedStepResult(projectId, stepInput);
      const project = useBreedingStore.getState().getProjectById(projectId)!;
      expect(project.progress).toHaveLength(1);
      const step = project.progress[0];
      expect(step.id).toBe(stepId);
      expect(typeof stepId).toBe('string');
      expect(stepId.length).toBeGreaterThan(0);
      expect(new Date(step.reportedAt).toISOString()).toBe(step.reportedAt);
    });

    it('preserves all provided step fields', () => {
      const projectId = useBreedingStore.getState().addProject({ name: 'P', goal: makeGoal() });
      const stepInput = {
        parentAId: 'mon-a',
        parentBId: 'mon-b',
        heldItems: { a: 'everstone' as const, b: 'powerBracer' as const },
        resultPokemonId: 'mon-result',
        costSpent: 5000,
      };
      useBreedingStore.getState().addBreedStepResult(projectId, stepInput);
      const step = useBreedingStore.getState().getProjectById(projectId)!.progress[0];
      expect(step.parentAId).toBe('mon-a');
      expect(step.parentBId).toBe('mon-b');
      expect(step.heldItems).toEqual({ a: 'everstone', b: 'powerBracer' });
      expect(step.resultPokemonId).toBe('mon-result');
      expect(step.costSpent).toBe(5000);
    });

    it('does not affect other projects', () => {
      const id1 = useBreedingStore.getState().addProject({ name: 'A', goal: makeGoal() });
      const id2 = useBreedingStore.getState().addProject({ name: 'B', goal: makeGoal() });
      useBreedingStore.getState().addBreedStepResult(id1, {
        parentAId: 'a', parentBId: 'b', heldItems: {}, resultPokemonId: 'r', costSpent: 0,
      });
      expect(useBreedingStore.getState().getProjectById(id2)!.progress).toHaveLength(0);
    });

    it('returns a unique id per step', () => {
      const projectId = useBreedingStore.getState().addProject({ name: 'P', goal: makeGoal() });
      const stepBase = { parentAId: 'a', parentBId: 'b', heldItems: {}, resultPokemonId: 'r', costSpent: 0 };
      const stepId1 = useBreedingStore.getState().addBreedStepResult(projectId, stepBase);
      const stepId2 = useBreedingStore.getState().addBreedStepResult(projectId, stepBase);
      expect(stepId1).not.toBe(stepId2);
    });
  });
});

// ---------------------------------------------------------------------------
// SETTINGS SLICE
// ---------------------------------------------------------------------------

describe('settingsSlice', () => {
  it('initial settings deep-equal DEFAULT_SETTINGS', () => {
    expect(useBreedingStore.getState().settings).toEqual(DEFAULT_SETTINGS);
  });

  describe('updatePrices', () => {
    it('merges a partial price patch leaving other prices intact', () => {
      useBreedingStore.getState().updatePrices({ powerWeight: 12345 });
      const { prices } = useBreedingStore.getState().settings;
      expect(prices.powerWeight).toBe(12345);
      // Other prices unchanged
      expect(prices.everstone).toBe(DEFAULT_SETTINGS.prices.everstone);
      expect(prices.ditto).toBe(DEFAULT_SETTINGS.prices.ditto);
      expect(prices.abilityPill).toBe(DEFAULT_SETTINGS.prices.abilityPill);
    });
  });

  describe('updateFeatures', () => {
    it('toggles a single feature leaving others unchanged', () => {
      useBreedingStore.getState().updateFeatures({ eggMoves: true });
      const { features } = useBreedingStore.getState().settings;
      expect(features.eggMoves).toBe(true);
      expect(features.hiddenAbility).toBe(false);
      expect(features.shiny).toBe(false);
      expect(features.alpha).toBe(false);
    });
  });

  describe('updateMechanics', () => {
    it('merges a mechanic patch leaving other mechanics intact', () => {
      useBreedingStore.getState().updateMechanics({ abilityPassRate: 0.9 });
      const { mechanics } = useBreedingStore.getState().settings;
      expect(mechanics.abilityPassRate).toBe(0.9);
      // Other mechanics unchanged
      expect(mechanics.everstoneConsumed).toBe(DEFAULT_SETTINGS.mechanics.everstoneConsumed);
      expect(mechanics.everstoneGuaranteed).toBe(DEFAULT_SETTINGS.mechanics.everstoneGuaranteed);
      expect(mechanics.regionalFormsSupported).toBe(DEFAULT_SETTINGS.mechanics.regionalFormsSupported);
    });
  });

  describe('resetSettings', () => {
    it('restores DEFAULT_SETTINGS after mutations', () => {
      useBreedingStore.getState().updatePrices({ powerWeight: 99999 });
      useBreedingStore.getState().updateFeatures({ shiny: true });
      useBreedingStore.getState().updateMechanics({ abilityPassRate: 0.5 });
      useBreedingStore.getState().resetSettings();
      expect(useBreedingStore.getState().settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  it('mutations do not mutate the DEFAULT_SETTINGS object itself', () => {
    const originalPrice = DEFAULT_SETTINGS.prices.powerWeight;
    useBreedingStore.getState().updatePrices({ powerWeight: 99999 });
    expect(DEFAULT_SETTINGS.prices.powerWeight).toBe(originalPrice);
  });
});

// ---------------------------------------------------------------------------
// MIGRATION
// ---------------------------------------------------------------------------

describe('migrate', () => {
  it('migrate(undefined, 0) returns a sane default-shaped object', () => {
    const result = migrate(undefined, 0) as Record<string, unknown>;
    expect(result).toBeDefined();
    expect(Array.isArray(result.ownedPokemon)).toBe(true);
    expect(Array.isArray(result.projects)).toBe(true);
    expect(result.settings).toBeDefined();
  });

  it('migrate(null, 0) returns a sane default-shaped object', () => {
    const result = migrate(null, 0) as Record<string, unknown>;
    expect(result).toBeDefined();
    expect(Array.isArray(result.ownedPokemon)).toBe(true);
    expect(Array.isArray(result.projects)).toBe(true);
  });

  it('migrate(null, 0) settings deep-merge over defaults', () => {
    const result = migrate(null, 0) as { settings: typeof DEFAULT_SETTINGS };
    expect(result.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('fills missing mechanics/prices keys from DEFAULT_SETTINGS while preserving provided values', () => {
    const partialState = {
      ownedPokemon: [{ id: 'test-mon' }],
      projects: [],
      settings: {
        prices: { powerWeight: 99 },
        features: { eggMoves: true, hiddenAbility: false, shiny: false, alpha: false },
        // mechanics intentionally missing
      },
    };
    const result = migrate(partialState, 0) as {
      settings: typeof DEFAULT_SETTINGS;
      ownedPokemon: unknown[];
    };
    // Provided price preserved
    expect(result.settings.prices.powerWeight).toBe(99);
    // Other prices filled from defaults
    expect(result.settings.prices.everstone).toBe(DEFAULT_SETTINGS.prices.everstone);
    // Missing mechanics filled from defaults
    expect(result.settings.mechanics).toEqual(DEFAULT_SETTINGS.mechanics);
    // Provided features preserved
    expect(result.settings.features.eggMoves).toBe(true);
    // Provided array preserved
    expect(result.ownedPokemon).toHaveLength(1);
  });

  it('migrate with version >= 1 passes state through (idempotent)', () => {
    const state = {
      ownedPokemon: [{ id: 'a' }],
      projects: [{ id: 'b' }],
      settings: DEFAULT_SETTINGS,
    };
    const result = migrate(state, 1);
    expect(result).toBe(state); // Same reference — passed through
  });

  it('migrate with version >= 1 passes state through for higher versions', () => {
    const state = { ownedPokemon: [], projects: [], settings: DEFAULT_SETTINGS, custom: 'extra' };
    const result = migrate(state, 5);
    expect(result).toBe(state);
  });

  it('garbage string input does not throw and yields a sane object', () => {
    let result: unknown;
    expect(() => {
      result = migrate('garbage', 0);
    }).not.toThrow();
    const r = result as Record<string, unknown>;
    expect(Array.isArray(r.ownedPokemon)).toBe(true);
    expect(Array.isArray(r.projects)).toBe(true);
  });

  it('garbage number input does not throw and yields a sane object', () => {
    let result: unknown;
    expect(() => {
      result = migrate(42, 0);
    }).not.toThrow();
    const r = result as Record<string, unknown>;
    expect(Array.isArray(r.ownedPokemon)).toBe(true);
    expect(Array.isArray(r.projects)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PERSISTENCE
// ---------------------------------------------------------------------------

describe('persistence', () => {
  it('after adding a pokemon the localStorage key exists and contains the id', async () => {
    // Allow zustand persist to flush
    const id = useBreedingStore.getState().addOwnedPokemon(makePokemonInput());

    // Zustand persist uses localStorage.setItem synchronously in its subscribe handler
    // Give it a tick to flush if needed
    await new Promise((r) => setTimeout(r, 0));

    const raw = localStorage.getItem('pokemmo-breeding-store');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    const json = JSON.stringify(parsed);
    expect(json).toContain(id);
  });
});
