import type { StatKey } from '../store/types';

export const NATURES: string[] = [
  'Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty',
  'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax',
  'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive',
  'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash',
  'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky',
];

export const NATURE_EFFECT: Record<string, { up: StatKey | null; down: StatKey | null }> = {
  Hardy:   { up: null,   down: null },
  Lonely:  { up: 'atk', down: 'def' },
  Brave:   { up: 'atk', down: 'spe' },
  Adamant: { up: 'atk', down: 'spa' },
  Naughty: { up: 'atk', down: 'spd' },
  Bold:    { up: 'def', down: 'atk' },
  Docile:  { up: null,  down: null },
  Relaxed: { up: 'def', down: 'spe' },
  Impish:  { up: 'def', down: 'spa' },
  Lax:     { up: 'def', down: 'spd' },
  Timid:   { up: 'spe', down: 'atk' },
  Hasty:   { up: 'spe', down: 'def' },
  Serious: { up: null,  down: null },
  Jolly:   { up: 'spe', down: 'spa' },
  Naive:   { up: 'spe', down: 'spd' },
  Modest:  { up: 'spa', down: 'atk' },
  Mild:    { up: 'spa', down: 'def' },
  Quiet:   { up: 'spa', down: 'spe' },
  Bashful: { up: null,  down: null },
  Rash:    { up: 'spa', down: 'spd' },
  Calm:    { up: 'spd', down: 'atk' },
  Gentle:  { up: 'spd', down: 'def' },
  Sassy:   { up: 'spd', down: 'spe' },
  Careful: { up: 'spd', down: 'spa' },
  Quirky:  { up: null,  down: null },
};
