import { describe, it, expect } from 'vitest';
import { NATURES, NATURE_EFFECT } from './natures';

describe('NATURES', () => {
  it('has exactly 25 entries', () => {
    expect(NATURES).toHaveLength(25);
  });

  it('contains Hardy', () => {
    expect(NATURES).toContain('Hardy');
  });

  it('contains Adamant', () => {
    expect(NATURES).toContain('Adamant');
  });

  it('all entries are unique', () => {
    expect(new Set(NATURES).size).toBe(NATURES.length);
  });
});

describe('NATURE_EFFECT', () => {
  it('Hardy is neutral (up: null, down: null)', () => {
    expect(NATURE_EFFECT.Hardy).toEqual({ up: null, down: null });
  });

  it('Adamant boosts atk and lowers spa', () => {
    expect(NATURE_EFFECT.Adamant).toEqual({ up: 'atk', down: 'spa' });
  });

  it('has an entry for every nature in NATURES', () => {
    for (const nature of NATURES) {
      expect(NATURE_EFFECT).toHaveProperty(nature);
    }
  });

  it('Timid boosts spe and lowers atk', () => {
    expect(NATURE_EFFECT.Timid).toEqual({ up: 'spe', down: 'atk' });
  });

  it('Modest boosts spa and lowers atk', () => {
    expect(NATURE_EFFECT.Modest).toEqual({ up: 'spa', down: 'atk' });
  });
});
