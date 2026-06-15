import { useMemo } from 'react';
import { useBreedingStore } from '../../store/index';
import { getSpeciesById } from '../../data/index';
import { buildFullPlan } from '../../engine/fullPlan';
import type { OwnedPokemon, BreedingProject } from '../../store/types';
import type { PokemonSpecies } from '../../data/types';

export interface ProjectRef {
  projectId: string;
  projectName: string;
}

/** Map each owned mon to the in-progress projects whose plan reserves it. */
export function computeReservations(
  pool: OwnedPokemon[],
  projects: BreedingProject[],
  getSpecies: (id: number) => PokemonSpecies | undefined,
): Record<string, ProjectRef[]> {
  const map: Record<string, ProjectRef[]> = {};
  for (const p of projects) {
    if (p.status !== 'in-progress') continue;
    const { reservedOwnedIds } = buildFullPlan(pool, p.goal, getSpecies);
    for (const id of reservedOwnedIds) {
      (map[id] ??= []).push({ projectId: p.id, projectName: p.name });
    }
  }
  return map;
}

/** Store-wired reservation map, recomputed only when pool or projects change. */
export function useReservations(): Record<string, ProjectRef[]> {
  const pool = useBreedingStore((s) => s.ownedPokemon);
  const projects = useBreedingStore((s) => s.projects);
  return useMemo(() => computeReservations(pool, projects, getSpeciesById), [pool, projects]);
}
