import { useBreedingStore } from './index';
import { DEFAULT_SETTINGS } from './defaults';
import type { OwnedPokemon, BreedingProject, Settings } from './types';

export interface ExportBundle {
  app: 'pokemmo-breeding-calculator';
  version: number;
  exportedAt: string;
  data: {
    ownedPokemon: OwnedPokemon[];
    projects: BreedingProject[];
    settings: Settings;
  };
}

export function buildExportBundle(
  state: { ownedPokemon: OwnedPokemon[]; projects: BreedingProject[]; settings: Settings },
  exportedAt: string,
): ExportBundle {
  return {
    app: 'pokemmo-breeding-calculator',
    version: 1,
    exportedAt,
    data: {
      ownedPokemon: state.ownedPokemon,
      projects: state.projects,
      settings: state.settings,
    },
  };
}

export function serializeExport(bundle: ExportBundle): string {
  return JSON.stringify(bundle, null, 2);
}

export function parseImport(
  jsonText: string,
):
  | { ok: true; data: { ownedPokemon: OwnedPokemon[]; projects: BreedingProject[]; settings: Settings } }
  | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: 'Invalid JSON: could not parse the file.' };
  }

  if (parsed === null || typeof parsed !== 'object') {
    return { ok: false, error: 'Invalid format: expected a JSON object.' };
  }

  const obj = parsed as Record<string, unknown>;

  // Accept either a full ExportBundle (has `.data`) or a raw shape.
  const raw: Record<string, unknown> =
    obj.data !== null && typeof obj.data === 'object'
      ? (obj.data as Record<string, unknown>)
      : obj;

  const ownedPokemon: OwnedPokemon[] = Array.isArray(raw.ownedPokemon)
    ? (raw.ownedPokemon as OwnedPokemon[])
    : [];

  const projects: BreedingProject[] = Array.isArray(raw.projects)
    ? (raw.projects as BreedingProject[])
    : [];

  const persistedSettings =
    raw.settings !== null && typeof raw.settings === 'object'
      ? (raw.settings as Record<string, unknown>)
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

  const settings: Settings = {
    prices: mergedPrices as Settings['prices'],
    features: mergedFeatures as Settings['features'],
    mechanics: mergedMechanics as Settings['mechanics'],
  };

  return { ok: true, data: { ownedPokemon, projects, settings } };
}

export function applyImport(parsed: {
  ownedPokemon: OwnedPokemon[];
  projects: BreedingProject[];
  settings: Settings;
}): void {
  useBreedingStore.setState({
    ownedPokemon: parsed.ownedPokemon,
    projects: parsed.projects,
    settings: parsed.settings,
  });
}
