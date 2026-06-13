import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  prices: {
    powerWeight: 10000,
    powerBracer: 10000,
    powerBelt: 10000,
    powerLens: 10000,
    powerBand: 10000,
    powerAnklet: 10000,
    everstone: 15000,
    genderFeeBase: 5000,
    genderFeeMax: 25000,
    abilityPill: 35000,
    ditto: 30000,
  },
  features: {
    eggMoves: false,
    hiddenAbility: false,
    shiny: false,
    alpha: false,
  },
  mechanics: {
    everstoneConsumed: true,
    everstoneGuaranteed: true,
    ivPassChanceOneItem: { high: 0.2, avg: 0.6, low: 0.2 },
    ivPassChanceTwoItems: { high: 0.125, avg: 0.75, low: 0.125 },
    abilityPassRate: 0.8,
    regionalFormsSupported: false,
  },
};
