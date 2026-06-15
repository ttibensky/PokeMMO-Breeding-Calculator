import { describe, it, expect } from 'vitest';
import { levenshtein, suggestSpecies } from './suggest';

describe('levenshtein', () => {
  it('is zero for identical strings', () => {
    expect(levenshtein('pikachu', 'pikachu')).toBe(0);
  });
  it('counts single-character edits', () => {
    expect(levenshtein('charizad', 'charizard')).toBe(1);
  });
});

describe('suggestSpecies', () => {
  it('suggests the closest real species for a near-miss', () => {
    // "Charizad" is one deletion from "Charizard".
    expect(suggestSpecies('Charizad')).toBe('Charizard');
  });
  it('returns undefined when nothing is close enough', () => {
    expect(suggestSpecies('zzzzzzzzzz')).toBeUndefined();
  });
});
