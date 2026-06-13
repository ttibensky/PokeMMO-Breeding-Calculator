import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { PokemonSpecies, PokemonDataset, Ability } from '../src/data/types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, '.dataset-cache');
const OUT_FILE = path.join(ROOT, 'src', 'data', 'pokemon.generated.json');

const BASE_URL = 'https://pokeapi.co/api/v2';
const CONCURRENCY = 8;
const MIN_ID = 1;
const MAX_ID = 649;

// Ensure cache dir exists
fs.mkdirSync(CACHE_DIR, { recursive: true });

function titleCase(str: string): string {
  return str
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function fetchWithRetry(url: string, retries = 3): Promise<unknown> {
  const cacheKey = url.replace(/[^a-z0-9]/gi, '_');
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);

  if (fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as unknown;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const data: unknown = await res.json();
      fs.writeFileSync(cachePath, JSON.stringify(data));
      return data;
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = 500 * 2 ** attempt;
      console.warn(`  Retry ${attempt + 1}/${retries} for ${url} in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error(`Exhausted retries for ${url}`);
}

interface PokeApiPokemon {
  types: { type: { name: string } }[];
  abilities: { ability: { name: string }; is_hidden: boolean }[];
  moves: { move: { name: string } }[];
}

interface PokeApiSpecies {
  egg_groups: { name: string }[];
  gender_rate: number;
  names: { name: string; language: { name: string } }[];
}

async function fetchSpecies(id: number): Promise<PokemonSpecies> {
  const [pokemon, species] = await Promise.all([
    fetchWithRetry(`${BASE_URL}/pokemon/${id}`) as Promise<PokeApiPokemon>,
    fetchWithRetry(`${BASE_URL}/pokemon-species/${id}`) as Promise<PokeApiSpecies>,
  ]);

  // Name: prefer English name from species, prettified
  const englishName = species.names.find((n) => n.language.name === 'en')?.name ?? String(id);
  // The species name from the API already uses proper casing (e.g. "Mr. Mime"), use it directly
  const name = englishName;

  const types = pokemon.types.map((t) => t.type.name);

  const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;

  const eggGroups = species.egg_groups.map((g) => g.name);

  const genderRate = species.gender_rate;
  const isGenderless = genderRate === -1;
  const femaleRatio = isGenderless ? 0 : genderRate / 8;

  const abilities: Ability[] = pokemon.abilities.map((a) => ({
    name: titleCase(a.ability.name),
    isHidden: a.is_hidden,
  }));

  const movesSet = new Set(pokemon.moves.map((m) => titleCase(m.move.name)));
  const moves = [...movesSet].sort();

  return { id, name, types, spriteUrl, eggGroups, genderRate, isGenderless, femaleRatio, abilities, moves };
}

async function runWithConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length) as T[];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

async function main() {
  console.log(`Fetching species ${MIN_ID}–${MAX_ID} from PokeAPI (concurrency=${CONCURRENCY})...`);

  const ids = Array.from({ length: MAX_ID - MIN_ID + 1 }, (_, i) => MIN_ID + i);
  let done = 0;

  const tasks = ids.map((id) => async () => {
    const s = await fetchSpecies(id);
    done++;
    if (done % 50 === 0) console.log(`  ${done}/${ids.length} fetched`);
    return s;
  });

  const allSpecies = await runWithConcurrency(tasks, CONCURRENCY);
  allSpecies.sort((a, b) => a.id - b.id);

  const dataset: PokemonDataset = {
    generatedAt: new Date().toISOString(),
    source: 'PokeAPI',
    speciesRange: [MIN_ID, MAX_ID],
    species: allSpecies,
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(dataset, null, 2));
  console.log(`Done. Wrote ${allSpecies.length} species to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
