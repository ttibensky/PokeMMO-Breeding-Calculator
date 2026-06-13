import type { StatKey } from '../../data/types';
import type { BreedingGoal, BreedingProject, ItemKey, ProjectStatus } from '../../store/types';
import { NATURE_EFFECT } from '../../data/natures';

export const STAT_LABELS: Record<StatKey, string> = {
  hp:  'HP',
  atk: 'Atk',
  def: 'Def',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'Spe',
};

export function formatNatureLabel(nature: string): string {
  const effect = NATURE_EFFECT[nature];
  if (!effect || effect.up === null || effect.down === null) {
    return `${nature} neutral`;
  }
  return `${nature} +${STAT_LABELS[effect.up]} −${STAT_LABELS[effect.down]}`;
}

export const STATUS_COLOR: Record<ProjectStatus, string> = {
  planning:    'gray',
  'in-progress': 'blue',
  done:        'green',
  abandoned:   'red',
};

export function targetStatKeysFromGoal(goal: BreedingGoal): StatKey[] {
  return (Object.keys(goal.targetIVs) as StatKey[]).filter(
    (s) => goal.targetIVs[s] === 31
  );
}

/**
 * Compact human-readable goal summary.
 * e.g. "4×31 HP/Atk/Def/Spe + Adamant ♀ ✦ (HA)"
 */
export function goalSummary(goal: BreedingGoal): string {
  const stats = targetStatKeysFromGoal(goal);
  const parts: string[] = [];

  if (stats.length > 0) {
    const statStr = stats.map((s) => STAT_LABELS[s]).join('/');
    parts.push(`${stats.length}×31 ${statStr}`);
  }

  if (goal.nature) {
    parts.push(`+ ${goal.nature}`);
  }

  const genderGlyph = goal.gender === 'male' ? '♂' : goal.gender === 'female' ? '♀' : null;
  if (genderGlyph) {
    parts.push(genderGlyph);
  }

  let result = parts.join(' ');

  if (goal.requireShiny) {
    result += ' ✦';
  }

  if (goal.requireHiddenAbility) {
    result += ' (HA)';
  }

  return result;
}

export function spentSoFar(project: BreedingProject): number {
  return project.progress.reduce((sum, step) => sum + step.costSpent, 0);
}

export function breedsDone(project: BreedingProject): number {
  return project.progress.length;
}

export function progressPercent(project: BreedingProject, totalBreeds: number): number {
  const done = project.status === 'done';
  if (totalBreeds <= 0) return done ? 100 : 0;
  const raw = Math.round((breedsDone(project) / totalBreeds) * 100);
  return Math.min(100, Math.max(0, raw));
}

const _moneyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function formatMoney(n: number): string {
  return _moneyFmt.format(n);
}

export const ITEM_LABELS: Record<ItemKey, string> = {
  powerWeight:  'Power Weight (HP)',
  powerBracer:  'Power Bracer (Atk)',
  powerBelt:    'Power Belt (Def)',
  powerLens:    'Power Lens (SpA)',
  powerBand:    'Power Band (SpD)',
  powerAnklet:  'Power Anklet (Spe)',
  everstone:    'Everstone',
};
