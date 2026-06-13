import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OwnedSlice } from './ownedSlice';
import type { ProjectsSlice } from './projectsSlice';
import type { SettingsSlice } from './settingsSlice';
import { createOwnedSlice } from './ownedSlice';
import { createProjectsSlice } from './projectsSlice';
import { createSettingsSlice } from './settingsSlice';
import { DEFAULT_SETTINGS } from './defaults';
import type { Settings } from './types';

export type StoreState = OwnedSlice & ProjectsSlice & SettingsSlice;

// Versioned migration — exported for unit testing.
export function migrate(persistedState: unknown, version: number): unknown {
  const base: { ownedPokemon: unknown[]; projects: unknown[]; settings: Settings } = {
    ownedPokemon: [],
    projects: [],
    settings: structuredClone(DEFAULT_SETTINGS),
  };

  if (persistedState === null || typeof persistedState !== 'object') {
    return base;
  }

  const state = persistedState as Record<string, unknown>;

  if (version < 1) {
    // v0 → v1: ensure arrays and deep-merge settings over defaults.
    const ownedPokemon = Array.isArray(state.ownedPokemon) ? state.ownedPokemon : [];
    const projects = Array.isArray(state.projects) ? state.projects : [];

    const persistedSettings =
      state.settings !== null && typeof state.settings === 'object'
        ? (state.settings as Record<string, unknown>)
        : {};

    const mergedPrices = {
      ...DEFAULT_SETTINGS.prices,
      ...(persistedSettings.prices !== null && typeof persistedSettings.prices === 'object'
        ? (persistedSettings.prices as Partial<Record<string, number>>)
        : {}),
    };
    const mergedFeatures = {
      ...DEFAULT_SETTINGS.features,
      ...(persistedSettings.features !== null && typeof persistedSettings.features === 'object'
        ? (persistedSettings.features as Partial<Record<string, boolean>>)
        : {}),
    };
    const mergedMechanics = {
      ...DEFAULT_SETTINGS.mechanics,
      ...(persistedSettings.mechanics !== null && typeof persistedSettings.mechanics === 'object'
        ? (persistedSettings.mechanics as Partial<Record<string, unknown>>)
        : {}),
    };

    return {
      ownedPokemon,
      projects,
      settings: { prices: mergedPrices, features: mergedFeatures, mechanics: mergedMechanics },
    };
  }

  return persistedState;
}

const INITIAL_OWNED: OwnedSlice['ownedPokemon'] = [];
const INITIAL_PROJECTS: ProjectsSlice['projects'] = [];

export const useBreedingStore = create<StoreState>()(
  persist(
    (...args) => ({
      ...createOwnedSlice(...args),
      ...createProjectsSlice(...args),
      ...createSettingsSlice(...args),
    }),
    {
      name: 'pokemmo-breeding-store',
      version: 1,
      migrate,
    }
  )
);

// Test reset hook — sets store back to initial state.
export function resetStore(): void {
  useBreedingStore.setState({
    ownedPokemon: INITIAL_OWNED,
    projects: INITIAL_PROJECTS,
    settings: structuredClone(DEFAULT_SETTINGS),
  });
}

// Re-export types for convenience.
export type { OwnedSlice } from './ownedSlice';
export type { ProjectsSlice } from './projectsSlice';
export type { SettingsSlice } from './settingsSlice';
export * from './types';
export { DEFAULT_SETTINGS } from './defaults';
