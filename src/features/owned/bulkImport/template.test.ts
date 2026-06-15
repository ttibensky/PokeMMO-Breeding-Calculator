import { describe, it, expect } from 'vitest';
import { buildTemplateCsv, TEMPLATE_HEADER } from './template';
import { parseDelimited } from './parseCsv';
import { validateRows } from './validateRows';
import { getSpeciesByName } from '../../../data/index';

describe('bulk import template', () => {
  it('header lists the recognized fill-in columns', () => {
    expect(TEMPLATE_HEADER).toBe('species,ivs,nature,ability,gender,shiny,alpha,eggMoves,notes');
  });

  it('the example row validates as a single ok row (battle-perfect Mewtwo)', () => {
    const res = validateRows(parseDelimited(buildTemplateCsv()));
    expect(res.headerError).toBeUndefined();
    expect(res.unknownColumns).toEqual([]);
    expect(res.rows).toHaveLength(1);
    const row = res.rows[0];
    expect(row.ok).toBe(true);
    if (!row.ok) return;
    expect(row.value.speciesId).toBe(getSpeciesByName('Mewtwo')!.id);
    expect(row.value.gender).toBe('genderless');
    expect(row.value.ivs.atk).toBe(0);
    expect(row.value.ivs.hp).toBe(31);
  });
});
