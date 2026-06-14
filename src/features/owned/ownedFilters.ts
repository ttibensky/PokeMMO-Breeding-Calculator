import type { OwnedPokemon } from '../../store/types';
import type { Gender, IVs } from '../../data/types';
import { getSpeciesById } from '../../data/index';
import { countPerfectIVs } from './ownedHelpers';

export type OwnedSortKey = 'createdAt' | 'name' | 'totalIVs' | 'perfectIVs';
export type SortDir = 'asc' | 'desc';

export interface OwnedFilterCriteria {
  search: string;
  nature: string | null;
  ability: string | null;
  gender: Gender | null;
  eggGroup: string | null;
  shinyOnly: boolean;
  alphaOnly: boolean;
  sortKey: OwnedSortKey;
  sortDir: SortDir;
}

export const DEFAULT_CRITERIA: OwnedFilterCriteria = {
  search: '',
  nature: null,
  ability: null,
  gender: null,
  eggGroup: null,
  shinyOnly: false,
  alphaOnly: false,
  sortKey: 'createdAt',
  sortDir: 'asc',
};

export function totalIVs(ivs: IVs): number {
  return ivs.hp + ivs.atk + ivs.def + ivs.spa + ivs.spd + ivs.spe;
}

export function deriveFilterOptions(list: OwnedPokemon[]): {
  natures: string[];
  abilities: string[];
  genders: Gender[];
  eggGroups: string[];
} {
  const natures = new Set<string>();
  const abilities = new Set<string>();
  const genders = new Set<Gender>();
  const eggGroups = new Set<string>();

  for (const mon of list) {
    natures.add(mon.nature);
    abilities.add(mon.ability);
    genders.add(mon.gender);
    const species = getSpeciesById(mon.speciesId);
    if (species) {
      for (const eg of species.eggGroups) {
        eggGroups.add(eg);
      }
    }
  }

  return {
    natures: [...natures].sort((a, b) => a.localeCompare(b)),
    abilities: [...abilities].sort((a, b) => a.localeCompare(b)),
    genders: [...genders].sort((a, b) => a.localeCompare(b)) as Gender[],
    eggGroups: [...eggGroups].sort((a, b) => a.localeCompare(b)),
  };
}

export function filterAndSortOwned(list: OwnedPokemon[], c: OwnedFilterCriteria): OwnedPokemon[] {
  const searchLower = c.search.toLowerCase();

  const filtered = list.filter((mon) => {
    if (c.search) {
      const species = getSpeciesById(mon.speciesId);
      const name = species?.name ?? '';
      if (!name.toLowerCase().includes(searchLower)) return false;
    }
    if (c.nature !== null && mon.nature !== c.nature) return false;
    if (c.ability !== null && mon.ability !== c.ability) return false;
    if (c.gender !== null && mon.gender !== c.gender) return false;
    if (c.eggGroup !== null) {
      const species = getSpeciesById(mon.speciesId);
      if (!species?.eggGroups.includes(c.eggGroup)) return false;
    }
    if (c.shinyOnly && !mon.isShiny) return false;
    if (c.alphaOnly && !mon.isAlpha) return false;
    return true;
  });

  // Decorate with original index for stable sort tiebreaking
  const decorated = filtered.map((mon, i) => ({ mon, i }));

  decorated.sort((a, b) => {
    let cmp = 0;
    switch (c.sortKey) {
      case 'name': {
        const nameA = getSpeciesById(a.mon.speciesId)?.name ?? '';
        const nameB = getSpeciesById(b.mon.speciesId)?.name ?? '';
        cmp = nameA.localeCompare(nameB);
        break;
      }
      case 'totalIVs':
        cmp = totalIVs(a.mon.ivs) - totalIVs(b.mon.ivs);
        break;
      case 'perfectIVs':
        cmp = countPerfectIVs(a.mon.ivs) - countPerfectIVs(b.mon.ivs);
        break;
      case 'createdAt':
        cmp = a.mon.createdAt.localeCompare(b.mon.createdAt);
        break;
    }
    if (cmp === 0) return a.i - b.i;
    return c.sortDir === 'asc' ? cmp : -cmp;
  });

  return decorated.map(({ mon }) => mon);
}
