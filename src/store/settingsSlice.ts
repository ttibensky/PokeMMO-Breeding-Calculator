import type { StateCreator } from 'zustand';
import type { Settings, PriceKey, FeatureToggles, MechanicConstants } from './types';
import { DEFAULT_SETTINGS } from './defaults';

export interface SettingsSlice {
  settings: Settings;
  updatePrices: (patch: Partial<Record<PriceKey, number>>) => void;
  updateFeatures: (patch: Partial<FeatureToggles>) => void;
  updateMechanics: (patch: Partial<MechanicConstants>) => void;
  resetSettings: () => void;
}

export const createSettingsSlice: StateCreator<SettingsSlice> = (set) => ({
  settings: structuredClone(DEFAULT_SETTINGS),

  updatePrices: (patch) => {
    set((state) => ({
      settings: {
        ...state.settings,
        prices: { ...state.settings.prices, ...patch },
      },
    }));
  },

  updateFeatures: (patch) => {
    set((state) => ({
      settings: {
        ...state.settings,
        features: { ...state.settings.features, ...patch },
      },
    }));
  },

  updateMechanics: (patch) => {
    set((state) => ({
      settings: {
        ...state.settings,
        mechanics: { ...state.settings.mechanics, ...patch },
      },
    }));
  },

  resetSettings: () => {
    set({ settings: structuredClone(DEFAULT_SETTINGS) });
  },
});
