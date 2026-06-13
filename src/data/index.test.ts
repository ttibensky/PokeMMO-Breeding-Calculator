import { describe, it, expect } from 'vitest';
import {
  allSpecies,
  getSpeciesById,
  getSpeciesByName,
  searchSpecies,
  isDitto,
  DITTO_ID,
} from './index.ts';

describe('dataset loader', () => {
  it('has exactly 649 species', () => {
    expect(allSpecies).toHaveLength(649);
  });

  it('has contiguous ids from 1 to 649', () => {
    const sorted = [...allSpecies].sort((a, b) => a.id - b.id);
    for (let i = 0; i < sorted.length; i++) {
      expect(sorted[i].id).toBe(i + 1);
    }
  });

  it('getSpeciesById(1) is Bulbasaur', () => {
    const s = getSpeciesById(1);
    expect(s).toBeDefined();
    expect(s!.name).toBe('Bulbasaur');
    expect(s!.id).toBe(1);
  });

  it('getSpeciesById(132) is Ditto', () => {
    const s = getSpeciesById(132);
    expect(s).toBeDefined();
    expect(s!.name).toBe('Ditto');
  });

  it('isDitto(132) is true', () => {
    expect(isDitto(DITTO_ID)).toBe(true);
    expect(isDitto(1)).toBe(false);
  });

  it('getSpeciesByName is case-insensitive', () => {
    expect(getSpeciesByName('bulbasaur')).toBeDefined();
    expect(getSpeciesByName('BULBASAUR')).toBeDefined();
    expect(getSpeciesByName('BuLbAsAuR')!.id).toBe(1);
  });

  it('getSpeciesByName returns undefined for unknown', () => {
    expect(getSpeciesByName('notapokemon')).toBeUndefined();
  });

  it('searchSpecies("char") includes Charmander and Charizard', () => {
    const results = searchSpecies('char');
    const names = results.map((s) => s.name);
    expect(names).toContain('Charmander');
    expect(names).toContain('Charizard');
  });

  it('searchSpecies results are sorted by id', () => {
    const results = searchSpecies('char');
    for (let i = 1; i < results.length; i++) {
      expect(results[i].id).toBeGreaterThan(results[i - 1].id);
    }
  });

  it('searchSpecies("") returns all 649 species', () => {
    expect(searchSpecies('')).toHaveLength(649);
  });

  it('every species has a non-empty name', () => {
    for (const s of allSpecies) {
      expect(s.name.length).toBeGreaterThan(0);
    }
  });

  it('every species has a spriteUrl matching the expected pattern', () => {
    for (const s of allSpecies) {
      expect(s.spriteUrl).toBe(
        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${s.id}.png`
      );
    }
  });

  it('every species has an eggGroups array (possibly empty)', () => {
    for (const s of allSpecies) {
      expect(Array.isArray(s.eggGroups)).toBe(true);
    }
  });

  it('every species has at least one non-hidden ability', () => {
    for (const s of allSpecies) {
      const nonHidden = s.abilities.filter((a) => !a.isHidden);
      expect(nonHidden.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every species has femaleRatio in [0, 1]', () => {
    for (const s of allSpecies) {
      expect(s.femaleRatio).toBeGreaterThanOrEqual(0);
      expect(s.femaleRatio).toBeLessThanOrEqual(1);
    }
  });

  it('Magnemite (id=81) is genderless', () => {
    const s = getSpeciesById(81);
    expect(s).toBeDefined();
    expect(s!.isGenderless).toBe(true);
    expect(s!.genderRate).toBe(-1);
    expect(s!.femaleRatio).toBe(0);
  });

  it('Ditto is genderless', () => {
    const s = getSpeciesById(132);
    expect(s!.isGenderless).toBe(true);
    expect(s!.eggGroups).toContain('ditto');
  });

  it('Bulbasaur has correct egg groups', () => {
    const s = getSpeciesById(1);
    expect(s!.eggGroups).toContain('monster');
  });

  it('Bulbasaur types are grass and poison', () => {
    const s = getSpeciesById(1);
    expect(s!.types).toContain('grass');
    expect(s!.types).toContain('poison');
  });
});
