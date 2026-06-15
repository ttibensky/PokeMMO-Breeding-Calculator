import { allSpecies } from '../../../data/index';

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Closest dataset species name to `name`, or undefined if none is close enough. */
export function suggestSpecies(name: string): string | undefined {
  const target = name.trim().toLowerCase();
  if (target === '') return undefined;
  let best: { name: string; dist: number } | undefined;
  for (const s of allSpecies) {
    const d = levenshtein(target, s.name.toLowerCase());
    if (best === undefined || d < best.dist) best = { name: s.name, dist: d };
  }
  const threshold = Math.max(2, Math.floor(target.length * 0.34));
  return best && best.dist <= threshold ? best.name : undefined;
}
