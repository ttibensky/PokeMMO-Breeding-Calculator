import { describe, it, expect } from 'vitest';
import type { OwnedPokemon } from '../../store/types';
import type { IVs, Gender } from '../../data/types';
import {
  DEFAULT_CRITERIA,
  totalIVs,
  deriveFilterOptions,
  filterAndSortOwned,
  type OwnedFilterCriteria,
} from './ownedFilters';

// ---------------------------------------------------------------------------
// Real species used in fixtures (all verified against the dataset):
//   id=1  Bulbasaur  eggGroups: ["monster","plant"]  ability: Overgrow
//   id=4  Charmander eggGroups: ["monster","dragon"]  ability: Blaze
//   id=10 Caterpie   eggGroups: ["bug"]               ability: Shield Dust
//   id=16 Pidgey     eggGroups: ["flying"]             ability: Keen Eye
//
// Name sort order (localeCompare): Bulbasaur < Caterpie < Charmander < Pidgey
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------

let _nextId = 1;

function makeOwned(overrides: Partial<OwnedPokemon> & { speciesId: number }): OwnedPokemon {
  const id = String(_nextId++);
  return {
    id,
    ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    nature: 'Hardy',
    ability: 'Overgrow',
    isHiddenAbility: false,
    gender: 'male' as Gender,
    isShiny: false,
    isAlpha: false,
    eggMoves: [],
    createdAt: `2024-01-0${id}T00:00:00.000Z`,
    ...overrides,
  };
}

function ivs(hp: number, atk: number, def: number, spa: number, spd: number, spe: number): IVs {
  return { hp, atk, def, spa, spd, spe };
}

// ---------------------------------------------------------------------------
// DEFAULT_CRITERIA
// ---------------------------------------------------------------------------

describe('DEFAULT_CRITERIA', () => {
  it('has the expected shape and values', () => {
    expect(DEFAULT_CRITERIA).toEqual({
      search: '',
      nature: null,
      ability: null,
      gender: null,
      eggGroup: null,
      shinyOnly: false,
      alphaOnly: false,
      sortKey: 'createdAt',
      sortDir: 'asc',
    });
  });
});

// ---------------------------------------------------------------------------
// totalIVs
// ---------------------------------------------------------------------------

describe('totalIVs', () => {
  it('sums all six stats correctly', () => {
    expect(totalIVs(ivs(10, 20, 5, 15, 8, 12))).toBe(70);
  });

  it('returns 0 for all-zero IVs', () => {
    expect(totalIVs(ivs(0, 0, 0, 0, 0, 0))).toBe(0);
  });

  it('returns 186 for all-31 IVs', () => {
    expect(totalIVs(ivs(31, 31, 31, 31, 31, 31))).toBe(186);
  });
});

// ---------------------------------------------------------------------------
// deriveFilterOptions
// ---------------------------------------------------------------------------

describe('deriveFilterOptions', () => {
  it('returns all empty arrays for an empty list', () => {
    const opts = deriveFilterOptions([]);
    expect(opts.natures).toEqual([]);
    expect(opts.abilities).toEqual([]);
    expect(opts.genders).toEqual([]);
    expect(opts.eggGroups).toEqual([]);
  });

  it('de-duplicates repeated nature/ability/gender values', () => {
    const list = [
      makeOwned({ speciesId: 1, nature: 'Hardy', ability: 'Overgrow', gender: 'male' }),
      makeOwned({ speciesId: 1, nature: 'Hardy', ability: 'Overgrow', gender: 'male' }),
    ];
    const opts = deriveFilterOptions(list);
    expect(opts.natures).toEqual(['Hardy']);
    expect(opts.abilities).toEqual(['Overgrow']);
    expect(opts.genders).toEqual(['male']);
  });

  it('sorts natures and abilities alphabetically', () => {
    const list = [
      makeOwned({ speciesId: 1, nature: 'Timid', ability: 'Chlorophyll' }),
      makeOwned({ speciesId: 1, nature: 'Adamant', ability: 'Overgrow' }),
    ];
    const opts = deriveFilterOptions(list);
    expect(opts.natures).toEqual(['Adamant', 'Timid']);
    expect(opts.abilities).toEqual(['Chlorophyll', 'Overgrow']);
  });

  it('collects egg groups from species via dataset lookup', () => {
    // speciesId=1  (Bulbasaur) → monster, plant
    // speciesId=10 (Caterpie)  → bug
    const list = [
      makeOwned({ speciesId: 1 }),
      makeOwned({ speciesId: 10 }),
    ];
    const opts = deriveFilterOptions(list);
    // sorted: bug < monster < plant
    expect(opts.eggGroups).toEqual(['bug', 'monster', 'plant']);
  });

  it('de-duplicates egg groups shared by multiple entries', () => {
    // Both Bulbasaur(1) and Charmander(4) share "monster"
    const list = [
      makeOwned({ speciesId: 1 }),
      makeOwned({ speciesId: 4 }),
    ];
    const opts = deriveFilterOptions(list);
    const monsterCount = opts.eggGroups.filter((g) => g === 'monster').length;
    expect(monsterCount).toBe(1);
  });

  it('only includes gender values that are present in the list', () => {
    const list = [
      makeOwned({ speciesId: 1, gender: 'female' }),
    ];
    const opts = deriveFilterOptions(list);
    expect(opts.genders).toEqual(['female']);
    expect(opts.genders).not.toContain('male');
  });

  it('sorts genders alphabetically (female < genderless < male)', () => {
    const list = [
      makeOwned({ speciesId: 1, gender: 'male' }),
      makeOwned({ speciesId: 1, gender: 'genderless' }),
      makeOwned({ speciesId: 1, gender: 'female' }),
    ];
    const opts = deriveFilterOptions(list);
    expect(opts.genders).toEqual(['female', 'genderless', 'male']);
  });
});

// ---------------------------------------------------------------------------
// filterAndSortOwned — search
// ---------------------------------------------------------------------------

describe('filterAndSortOwned – search', () => {
  const bulbasaur = makeOwned({ speciesId: 1 });  // Bulbasaur
  const charmander = makeOwned({ speciesId: 4 });  // Charmander
  const list = [bulbasaur, charmander];

  it('returns all items when search is empty string', () => {
    const result = filterAndSortOwned(list, { ...DEFAULT_CRITERIA });
    expect(result).toHaveLength(2);
  });

  it('matches substring case-insensitively', () => {
    const result = filterAndSortOwned(list, { ...DEFAULT_CRITERIA, search: 'bulba' });
    expect(result).toHaveLength(1);
    expect(result[0].speciesId).toBe(1);
  });

  it('is case-insensitive (uppercase query)', () => {
    const result = filterAndSortOwned(list, { ...DEFAULT_CRITERIA, search: 'CHAR' });
    expect(result).toHaveLength(1);
    expect(result[0].speciesId).toBe(4);
  });

  it('returns empty when search matches nothing', () => {
    const result = filterAndSortOwned(list, { ...DEFAULT_CRITERIA, search: 'zzz' });
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// filterAndSortOwned — nature / ability / gender filters
// ---------------------------------------------------------------------------

describe('filterAndSortOwned – nature/ability/gender exact filters', () => {
  const mon1 = makeOwned({ speciesId: 1, nature: 'Adamant', ability: 'Overgrow', gender: 'male' });
  const mon2 = makeOwned({ speciesId: 1, nature: 'Timid', ability: 'Chlorophyll', gender: 'female' });
  const list = [mon1, mon2];

  it('null nature passes all', () => {
    expect(filterAndSortOwned(list, { ...DEFAULT_CRITERIA, nature: null })).toHaveLength(2);
  });

  it('non-null nature filters to exact match only', () => {
    const result = filterAndSortOwned(list, { ...DEFAULT_CRITERIA, nature: 'Adamant' });
    expect(result).toHaveLength(1);
    expect(result[0].nature).toBe('Adamant');
  });

  it('null ability passes all', () => {
    expect(filterAndSortOwned(list, { ...DEFAULT_CRITERIA, ability: null })).toHaveLength(2);
  });

  it('non-null ability filters to exact match only', () => {
    const result = filterAndSortOwned(list, { ...DEFAULT_CRITERIA, ability: 'Chlorophyll' });
    expect(result).toHaveLength(1);
    expect(result[0].ability).toBe('Chlorophyll');
  });

  it('null gender passes all', () => {
    expect(filterAndSortOwned(list, { ...DEFAULT_CRITERIA, gender: null })).toHaveLength(2);
  });

  it('non-null gender filters to exact match only', () => {
    const result = filterAndSortOwned(list, { ...DEFAULT_CRITERIA, gender: 'female' });
    expect(result).toHaveLength(1);
    expect(result[0].gender).toBe('female');
  });
});

// ---------------------------------------------------------------------------
// filterAndSortOwned — eggGroup filter
// ---------------------------------------------------------------------------

describe('filterAndSortOwned – eggGroup filter', () => {
  // Bulbasaur(1): monster,plant  Caterpie(10): bug  Pidgey(16): flying
  const bulbasaur = makeOwned({ speciesId: 1 });
  const caterpie = makeOwned({ speciesId: 10 });
  const pidgey = makeOwned({ speciesId: 16 });
  const list = [bulbasaur, caterpie, pidgey];

  it('null eggGroup passes all', () => {
    expect(filterAndSortOwned(list, { ...DEFAULT_CRITERIA, eggGroup: null })).toHaveLength(3);
  });

  it('keeps only Pokémon whose species has the given egg group', () => {
    const result = filterAndSortOwned(list, { ...DEFAULT_CRITERIA, eggGroup: 'bug' });
    expect(result).toHaveLength(1);
    expect(result[0].speciesId).toBe(10);
  });

  it('matches Bulbasaur on "monster" (its first egg group)', () => {
    const result = filterAndSortOwned(list, { ...DEFAULT_CRITERIA, eggGroup: 'monster' });
    expect(result).toHaveLength(1);
    expect(result[0].speciesId).toBe(1);
  });

  it('matches Bulbasaur on "plant" (its second egg group)', () => {
    const result = filterAndSortOwned(list, { ...DEFAULT_CRITERIA, eggGroup: 'plant' });
    expect(result).toHaveLength(1);
    expect(result[0].speciesId).toBe(1);
  });

  it('returns empty for an egg group not present in the list', () => {
    const result = filterAndSortOwned(list, { ...DEFAULT_CRITERIA, eggGroup: 'water1' });
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// filterAndSortOwned — shinyOnly / alphaOnly
// ---------------------------------------------------------------------------

describe('filterAndSortOwned – shinyOnly / alphaOnly', () => {
  const normal = makeOwned({ speciesId: 1, isShiny: false, isAlpha: false });
  const shiny = makeOwned({ speciesId: 1, isShiny: true, isAlpha: false });
  const alpha = makeOwned({ speciesId: 1, isShiny: false, isAlpha: true });
  const shinyAlpha = makeOwned({ speciesId: 1, isShiny: true, isAlpha: true });
  const list = [normal, shiny, alpha, shinyAlpha];

  it('shinyOnly:false returns all', () => {
    expect(filterAndSortOwned(list, { ...DEFAULT_CRITERIA, shinyOnly: false })).toHaveLength(4);
  });

  it('shinyOnly:true keeps only shiny entries', () => {
    const result = filterAndSortOwned(list, { ...DEFAULT_CRITERIA, shinyOnly: true });
    expect(result).toHaveLength(2);
    expect(result.every((m) => m.isShiny)).toBe(true);
  });

  it('alphaOnly:false returns all', () => {
    expect(filterAndSortOwned(list, { ...DEFAULT_CRITERIA, alphaOnly: false })).toHaveLength(4);
  });

  it('alphaOnly:true keeps only alpha entries', () => {
    const result = filterAndSortOwned(list, { ...DEFAULT_CRITERIA, alphaOnly: true });
    expect(result).toHaveLength(2);
    expect(result.every((m) => m.isAlpha)).toBe(true);
  });

  it('shinyOnly AND alphaOnly together keep only shiny+alpha', () => {
    const result = filterAndSortOwned(list, { ...DEFAULT_CRITERIA, shinyOnly: true, alphaOnly: true });
    expect(result).toHaveLength(1);
    expect(result[0].isShiny).toBe(true);
    expect(result[0].isAlpha).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// filterAndSortOwned — combined AND filters
// ---------------------------------------------------------------------------

describe('filterAndSortOwned – combined AND filters', () => {
  // Bulbasaur male Adamant shiny
  const a = makeOwned({ speciesId: 1, nature: 'Adamant', gender: 'male', isShiny: true });
  // Bulbasaur female Adamant not-shiny
  const b = makeOwned({ speciesId: 1, nature: 'Adamant', gender: 'female', isShiny: false });
  // Charmander male Adamant shiny
  const c = makeOwned({ speciesId: 4, nature: 'Adamant', gender: 'male', isShiny: true });
  const list = [a, b, c];

  it('multiple criteria narrow results via AND semantics', () => {
    // nature=Adamant AND gender=male AND shinyOnly → should match a and c
    const result = filterAndSortOwned(list, {
      ...DEFAULT_CRITERIA,
      nature: 'Adamant',
      gender: 'male',
      shinyOnly: true,
    });
    expect(result).toHaveLength(2);
    const ids = result.map((m) => m.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(c.id);
  });

  it('search combined with nature filter narrows further', () => {
    // search="bulba" AND nature=Adamant → only a (Bulbasaur male shiny) and b (Bulbasaur female not-shiny)
    const result = filterAndSortOwned(list, {
      ...DEFAULT_CRITERIA,
      search: 'bulba',
      nature: 'Adamant',
    });
    expect(result).toHaveLength(2);
    expect(result.every((m) => m.speciesId === 1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// filterAndSortOwned — sort by createdAt
// ---------------------------------------------------------------------------

describe('filterAndSortOwned – sort by createdAt', () => {
  // Create with explicit createdAt values out of order
  const early = makeOwned({ speciesId: 1, createdAt: '2024-01-01T00:00:00.000Z' });
  const mid = makeOwned({ speciesId: 1, createdAt: '2024-06-01T00:00:00.000Z' });
  const late = makeOwned({ speciesId: 1, createdAt: '2024-12-01T00:00:00.000Z' });
  const list = [late, early, mid]; // deliberately shuffled

  it('DEFAULT_CRITERIA sorts by createdAt ascending', () => {
    const result = filterAndSortOwned(list, DEFAULT_CRITERIA);
    expect(result[0].id).toBe(early.id);
    expect(result[1].id).toBe(mid.id);
    expect(result[2].id).toBe(late.id);
  });

  it('sortDir desc reverses the order', () => {
    const result = filterAndSortOwned(list, { ...DEFAULT_CRITERIA, sortDir: 'desc' });
    expect(result[0].id).toBe(late.id);
    expect(result[2].id).toBe(early.id);
  });

  it('stability: two equal createdAt values keep input (filtered) order in asc', () => {
    const sameTime1 = makeOwned({ speciesId: 1, createdAt: '2024-01-01T00:00:00.000Z' });
    const sameTime2 = makeOwned({ speciesId: 4, createdAt: '2024-01-01T00:00:00.000Z' });
    const result = filterAndSortOwned([sameTime1, sameTime2], DEFAULT_CRITERIA);
    expect(result[0].id).toBe(sameTime1.id);
    expect(result[1].id).toBe(sameTime2.id);
  });

  it('stability: two equal createdAt values keep input (filtered) order in desc', () => {
    const sameTime1 = makeOwned({ speciesId: 1, createdAt: '2024-01-01T00:00:00.000Z' });
    const sameTime2 = makeOwned({ speciesId: 4, createdAt: '2024-01-01T00:00:00.000Z' });
    const result = filterAndSortOwned([sameTime1, sameTime2], {
      ...DEFAULT_CRITERIA,
      sortDir: 'desc',
    });
    expect(result[0].id).toBe(sameTime1.id);
    expect(result[1].id).toBe(sameTime2.id);
  });
});

// ---------------------------------------------------------------------------
// filterAndSortOwned — sort by name
// ---------------------------------------------------------------------------

describe('filterAndSortOwned – sort by name', () => {
  // Bulbasaur(1) < Caterpie(10) < Charmander(4) < Pidgey(16) alphabetically
  const bulbasaur = makeOwned({ speciesId: 1 });
  const caterpie = makeOwned({ speciesId: 10 });
  const charmander = makeOwned({ speciesId: 4 });
  const pidgey = makeOwned({ speciesId: 16 });
  const list = [pidgey, charmander, bulbasaur, caterpie]; // shuffled

  it('sorts by species name ascending', () => {
    const result = filterAndSortOwned(list, { ...DEFAULT_CRITERIA, sortKey: 'name', sortDir: 'asc' });
    expect(result.map((m) => m.speciesId)).toEqual([1, 10, 4, 16]);
  });

  it('sorts by species name descending', () => {
    const result = filterAndSortOwned(list, { ...DEFAULT_CRITERIA, sortKey: 'name', sortDir: 'desc' });
    expect(result.map((m) => m.speciesId)).toEqual([16, 4, 10, 1]);
  });

  it('stability: two entries with the same species name keep input order in asc', () => {
    const b1 = makeOwned({ speciesId: 1 }); // Bulbasaur
    const b2 = makeOwned({ speciesId: 1 }); // Bulbasaur
    const result = filterAndSortOwned([b1, b2], { ...DEFAULT_CRITERIA, sortKey: 'name', sortDir: 'asc' });
    expect(result[0].id).toBe(b1.id);
    expect(result[1].id).toBe(b2.id);
  });

  it('stability: two entries with the same species name keep input order in desc', () => {
    const b1 = makeOwned({ speciesId: 1 }); // Bulbasaur
    const b2 = makeOwned({ speciesId: 1 }); // Bulbasaur
    const result = filterAndSortOwned([b1, b2], { ...DEFAULT_CRITERIA, sortKey: 'name', sortDir: 'desc' });
    expect(result[0].id).toBe(b1.id);
    expect(result[1].id).toBe(b2.id);
  });
});

// ---------------------------------------------------------------------------
// filterAndSortOwned — sort by totalIVs
// ---------------------------------------------------------------------------

describe('filterAndSortOwned – sort by totalIVs', () => {
  const low = makeOwned({ speciesId: 1, ivs: ivs(0, 0, 0, 0, 0, 0) });   // 0
  const mid = makeOwned({ speciesId: 1, ivs: ivs(15, 15, 15, 15, 15, 15) }); // 90
  const high = makeOwned({ speciesId: 1, ivs: ivs(31, 31, 31, 31, 31, 31) }); // 186
  const list = [high, low, mid]; // shuffled

  it('sorts by totalIVs ascending', () => {
    const result = filterAndSortOwned(list, { ...DEFAULT_CRITERIA, sortKey: 'totalIVs', sortDir: 'asc' });
    const totals = result.map((m) => totalIVs(m.ivs));
    expect(totals).toEqual([0, 90, 186]);
  });

  it('sorts by totalIVs descending', () => {
    const result = filterAndSortOwned(list, { ...DEFAULT_CRITERIA, sortKey: 'totalIVs', sortDir: 'desc' });
    const totals = result.map((m) => totalIVs(m.ivs));
    expect(totals).toEqual([186, 90, 0]);
  });

  it('stability: two entries with the same totalIVs keep input order in asc', () => {
    const t1 = makeOwned({ speciesId: 1, ivs: ivs(10, 10, 10, 10, 10, 10) }); // 60
    const t2 = makeOwned({ speciesId: 4, ivs: ivs(10, 10, 10, 10, 10, 10) }); // 60
    const result = filterAndSortOwned([t1, t2], { ...DEFAULT_CRITERIA, sortKey: 'totalIVs', sortDir: 'asc' });
    expect(result[0].id).toBe(t1.id);
    expect(result[1].id).toBe(t2.id);
  });

  it('stability: two entries with the same totalIVs keep input order in desc', () => {
    const t1 = makeOwned({ speciesId: 1, ivs: ivs(10, 10, 10, 10, 10, 10) }); // 60
    const t2 = makeOwned({ speciesId: 4, ivs: ivs(10, 10, 10, 10, 10, 10) }); // 60
    const result = filterAndSortOwned([t1, t2], { ...DEFAULT_CRITERIA, sortKey: 'totalIVs', sortDir: 'desc' });
    expect(result[0].id).toBe(t1.id);
    expect(result[1].id).toBe(t2.id);
  });
});

// ---------------------------------------------------------------------------
// filterAndSortOwned — sort by perfectIVs
// ---------------------------------------------------------------------------

describe('filterAndSortOwned – sort by perfectIVs', () => {
  const zero = makeOwned({ speciesId: 1, ivs: ivs(0, 0, 0, 0, 0, 0) });   // 0 perfect
  const two = makeOwned({ speciesId: 1, ivs: ivs(31, 31, 0, 0, 0, 0) });   // 2 perfect
  const six = makeOwned({ speciesId: 1, ivs: ivs(31, 31, 31, 31, 31, 31) }); // 6 perfect
  const list = [six, zero, two]; // shuffled

  it('sorts by perfectIVs ascending', () => {
    const result = filterAndSortOwned(list, { ...DEFAULT_CRITERIA, sortKey: 'perfectIVs', sortDir: 'asc' });
    expect(result.map((m) => m.id)).toEqual([zero.id, two.id, six.id]);
  });

  it('sorts by perfectIVs descending', () => {
    const result = filterAndSortOwned(list, { ...DEFAULT_CRITERIA, sortKey: 'perfectIVs', sortDir: 'desc' });
    expect(result.map((m) => m.id)).toEqual([six.id, two.id, zero.id]);
  });

  it('stability: two entries with the same perfectIVs keep input order in asc', () => {
    const p1 = makeOwned({ speciesId: 1, ivs: ivs(31, 0, 0, 0, 0, 0) }); // 1 perfect
    const p2 = makeOwned({ speciesId: 4, ivs: ivs(0, 31, 0, 0, 0, 0) }); // 1 perfect
    const result = filterAndSortOwned([p1, p2], { ...DEFAULT_CRITERIA, sortKey: 'perfectIVs', sortDir: 'asc' });
    expect(result[0].id).toBe(p1.id);
    expect(result[1].id).toBe(p2.id);
  });

  it('stability: two entries with the same perfectIVs keep input order in desc', () => {
    const p1 = makeOwned({ speciesId: 1, ivs: ivs(31, 0, 0, 0, 0, 0) }); // 1 perfect
    const p2 = makeOwned({ speciesId: 4, ivs: ivs(0, 31, 0, 0, 0, 0) }); // 1 perfect
    const result = filterAndSortOwned([p1, p2], { ...DEFAULT_CRITERIA, sortKey: 'perfectIVs', sortDir: 'desc' });
    expect(result[0].id).toBe(p1.id);
    expect(result[1].id).toBe(p2.id);
  });
});

// ---------------------------------------------------------------------------
// filterAndSortOwned — empty list
// ---------------------------------------------------------------------------

describe('filterAndSortOwned – empty list', () => {
  it('returns empty array when input is empty', () => {
    expect(filterAndSortOwned([], DEFAULT_CRITERIA)).toEqual([]);
  });

  it('returns empty array with various criteria on empty input', () => {
    const criteria: OwnedFilterCriteria = {
      ...DEFAULT_CRITERIA,
      search: 'bulba',
      nature: 'Adamant',
      shinyOnly: true,
    };
    expect(filterAndSortOwned([], criteria)).toEqual([]);
  });
});
