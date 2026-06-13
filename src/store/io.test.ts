import { describe, it, expect, beforeEach } from 'vitest';
import { buildExportBundle, serializeExport, parseImport, applyImport } from './io';
import { useBreedingStore, resetStore } from './index';
import { DEFAULT_SETTINGS } from './defaults';
import type { OwnedPokemon, Settings } from './types';

// Minimal valid OwnedPokemon for testing
function makeOwnedPokemon(overrides: Partial<OwnedPokemon> = {}): OwnedPokemon {
  return {
    id: 'test-id-1',
    speciesId: 1,
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    nature: 'Adamant',
    ability: 'Overgrow',
    isHiddenAbility: false,
    gender: 'male',
    isShiny: false,
    isAlpha: false,
    eggMoves: [],
    createdAt: '2026-06-13T00:00:00.000Z',
    ...overrides,
  };
}

const TEST_SETTINGS: Settings = DEFAULT_SETTINGS;

beforeEach(() => {
  localStorage.clear();
  resetStore();
});

// ---------------------------------------------------------------------------
// buildExportBundle
// ---------------------------------------------------------------------------

describe('buildExportBundle', () => {
  it('returns the correct ExportBundle shape', () => {
    const ownedPokemon = [makeOwnedPokemon()];
    const projects = [] as never[];
    const settings = TEST_SETTINGS;
    const exportedAt = '2026-06-13T00:00:00.000Z';

    const bundle = buildExportBundle({ ownedPokemon, projects, settings }, exportedAt);

    expect(bundle).toEqual({
      app: 'pokemmo-breeding-calculator',
      version: 1,
      exportedAt: '2026-06-13T00:00:00.000Z',
      data: { ownedPokemon, projects, settings },
    });
  });

  it('sets app to the correct string literal', () => {
    const bundle = buildExportBundle(
      { ownedPokemon: [], projects: [], settings: TEST_SETTINGS },
      '2026-06-13T00:00:00.000Z',
    );
    expect(bundle.app).toBe('pokemmo-breeding-calculator');
  });

  it('sets version to 1', () => {
    const bundle = buildExportBundle(
      { ownedPokemon: [], projects: [], settings: TEST_SETTINGS },
      '2026-06-13T00:00:00.000Z',
    );
    expect(bundle.version).toBe(1);
  });

  it('preserves the exportedAt timestamp exactly', () => {
    const bundle = buildExportBundle(
      { ownedPokemon: [], projects: [], settings: TEST_SETTINGS },
      '2026-06-13T00:00:00.000Z',
    );
    expect(bundle.exportedAt).toBe('2026-06-13T00:00:00.000Z');
  });

  it('data slices reference the original arrays', () => {
    const ownedPokemon = [makeOwnedPokemon()];
    const projects = [] as never[];
    const bundle = buildExportBundle(
      { ownedPokemon, projects, settings: TEST_SETTINGS },
      '2026-06-13T00:00:00.000Z',
    );
    expect(bundle.data.ownedPokemon).toBe(ownedPokemon);
    expect(bundle.data.projects).toBe(projects);
  });
});

// ---------------------------------------------------------------------------
// serializeExport
// ---------------------------------------------------------------------------

describe('serializeExport', () => {
  it('returns a string', () => {
    const bundle = buildExportBundle(
      { ownedPokemon: [], projects: [], settings: TEST_SETTINGS },
      '2026-06-13T00:00:00.000Z',
    );
    expect(typeof serializeExport(bundle)).toBe('string');
  });

  it('is pretty-printed (contains newlines)', () => {
    const bundle = buildExportBundle(
      { ownedPokemon: [], projects: [], settings: TEST_SETTINGS },
      '2026-06-13T00:00:00.000Z',
    );
    expect(serializeExport(bundle)).toContain('\n');
  });

  it('round-trips via JSON.parse back to the original bundle', () => {
    const bundle = buildExportBundle(
      { ownedPokemon: [makeOwnedPokemon()], projects: [], settings: TEST_SETTINGS },
      '2026-06-13T00:00:00.000Z',
    );
    const json = serializeExport(bundle);
    expect(JSON.parse(json)).toEqual(bundle);
  });
});

// ---------------------------------------------------------------------------
// parseImport
// ---------------------------------------------------------------------------

describe('parseImport — full ExportBundle shape (with .data)', () => {
  it('returns ok:true with the three slices from a full bundle JSON', () => {
    const mon = makeOwnedPokemon();
    const bundle = buildExportBundle(
      { ownedPokemon: [mon], projects: [], settings: TEST_SETTINGS },
      '2026-06-13T00:00:00.000Z',
    );
    const json = serializeExport(bundle);
    const result = parseImport(json);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.ownedPokemon).toEqual([mon]);
    expect(result.data.projects).toEqual([]);
    expect(result.data.settings).toBeDefined();
  });
});

describe('parseImport — raw shape (no .data wrapper)', () => {
  it('returns ok:true for raw {ownedPokemon, projects, settings} JSON', () => {
    const mon = makeOwnedPokemon();
    const raw = { ownedPokemon: [mon], projects: [], settings: TEST_SETTINGS };
    const result = parseImport(JSON.stringify(raw));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.ownedPokemon).toEqual([mon]);
    expect(result.data.projects).toEqual([]);
  });
});

describe('parseImport — defaults for missing/partial fields', () => {
  it('defaults ownedPokemon to [] when missing', () => {
    const json = JSON.stringify({ projects: [], settings: TEST_SETTINGS });
    const result = parseImport(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.ownedPokemon).toEqual([]);
  });

  it('defaults projects to [] when missing', () => {
    const json = JSON.stringify({ ownedPokemon: [], settings: TEST_SETTINGS });
    const result = parseImport(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.projects).toEqual([]);
  });

  it('deep-merges over DEFAULT_SETTINGS when settings is missing', () => {
    const json = JSON.stringify({ ownedPokemon: [], projects: [] });
    const result = parseImport(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // A default key should be present
    expect(result.data.settings.prices.powerWeight).toBe(DEFAULT_SETTINGS.prices.powerWeight);
    expect(result.data.settings.features).toEqual(DEFAULT_SETTINGS.features);
  });

  it('deep-merges partial settings over DEFAULT_SETTINGS', () => {
    const partialSettings = { prices: { powerWeight: 99999 } };
    const json = JSON.stringify({ ownedPokemon: [], projects: [], settings: partialSettings });
    const result = parseImport(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The overridden key
    expect(result.data.settings.prices.powerWeight).toBe(99999);
    // A default key not in the partial should still be present from DEFAULT_SETTINGS
    expect(result.data.settings.prices.everstone).toBe(DEFAULT_SETTINGS.prices.everstone);
    // Features should default
    expect(result.data.settings.features).toEqual(DEFAULT_SETTINGS.features);
  });
});

describe('parseImport — error cases', () => {
  it('returns ok:false with non-empty error string for invalid JSON', () => {
    const result = parseImport('not json{');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(typeof result.error).toBe('string');
    expect(result.error.length).toBeGreaterThan(0);
  });

  it('does not throw for invalid JSON', () => {
    expect(() => parseImport('not json{')).not.toThrow();
  });

  it('returns ok:false for a JSON number (non-object)', () => {
    const result = parseImport('123');
    expect(result.ok).toBe(false);
  });

  it('returns ok:false for a JSON string (non-object)', () => {
    const result = parseImport('"hello"');
    expect(result.ok).toBe(false);
  });

  it('returns ok:false for JSON null', () => {
    const result = parseImport('null');
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyImport
// ---------------------------------------------------------------------------

describe('applyImport', () => {
  it('sets ownedPokemon in the store', () => {
    const mon = makeOwnedPokemon();
    applyImport({ ownedPokemon: [mon], projects: [], settings: TEST_SETTINGS });
    expect(useBreedingStore.getState().ownedPokemon).toEqual([mon]);
  });

  it('replaces existing ownedPokemon with imported ones', () => {
    // Seed the store
    useBreedingStore.setState({ ownedPokemon: [makeOwnedPokemon({ id: 'old-id' })] });

    const newMon = makeOwnedPokemon({ id: 'new-id', speciesId: 25 });
    applyImport({ ownedPokemon: [newMon], projects: [], settings: TEST_SETTINGS });

    const state = useBreedingStore.getState();
    expect(state.ownedPokemon).toHaveLength(1);
    expect(state.ownedPokemon[0].id).toBe('new-id');
  });

  it('replaces projects with imported ones (empty)', () => {
    applyImport({ ownedPokemon: [], projects: [], settings: TEST_SETTINGS });
    expect(useBreedingStore.getState().projects).toEqual([]);
  });

  it('sets settings in the store', () => {
    const customSettings: Settings = {
      ...DEFAULT_SETTINGS,
      prices: { ...DEFAULT_SETTINGS.prices, powerWeight: 42000 },
    };
    applyImport({ ownedPokemon: [], projects: [], settings: customSettings });
    expect(useBreedingStore.getState().settings.prices.powerWeight).toBe(42000);
  });
});

// ---------------------------------------------------------------------------
// Full round-trip
// ---------------------------------------------------------------------------

describe('full round-trip', () => {
  it('seed → buildExportBundle → serialize → parseImport → applyImport → state matches', () => {
    const mon = makeOwnedPokemon({ id: 'round-trip-mon', speciesId: 150 });

    // Seed
    useBreedingStore.setState({
      ownedPokemon: [mon],
      projects: [],
      settings: TEST_SETTINGS,
    });

    // Export
    const state = useBreedingStore.getState();
    const bundle = buildExportBundle(
      { ownedPokemon: state.ownedPokemon, projects: state.projects, settings: state.settings },
      '2026-06-13T00:00:00.000Z',
    );
    const json = serializeExport(bundle);

    // Reset store
    resetStore();
    expect(useBreedingStore.getState().ownedPokemon).toHaveLength(0);

    // Import
    const result = parseImport(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    applyImport(result.data);

    // Verify
    const newState = useBreedingStore.getState();
    expect(newState.ownedPokemon).toEqual([mon]);
    expect(newState.projects).toEqual([]);
    expect(newState.settings).toEqual(TEST_SETTINGS);
  });
});
