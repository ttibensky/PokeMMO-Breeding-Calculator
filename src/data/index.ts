import rawDataset from './pokemon.generated.json';
import type { PokemonSpecies, PokemonDataset } from './types.ts';

const dataset = rawDataset as PokemonDataset;

export const DITTO_ID = 132;

// Internal O(1) map by id
const speciesById = new Map<number, PokemonSpecies>(
  dataset.species.map((s) => [s.id, s])
);

// Internal map by lowercase name
const speciesByNameLower = new Map<string, PokemonSpecies>(
  dataset.species.map((s) => [s.name.toLowerCase(), s])
);

export const allSpecies: PokemonSpecies[] = dataset.species;

export function getSpeciesById(id: number): PokemonSpecies | undefined {
  return speciesById.get(id);
}

export function getSpeciesByName(name: string): PokemonSpecies | undefined {
  return speciesByNameLower.get(name.toLowerCase());
}

export function searchSpecies(query: string): PokemonSpecies[] {
  if (!query) return [...allSpecies];
  const q = query.toLowerCase();
  return allSpecies.filter((s) => s.name.toLowerCase().includes(q));
}

export function isDitto(id: number): boolean {
  return id === DITTO_ID;
}

export type { PokemonSpecies, PokemonDataset };
export { speciesById };
