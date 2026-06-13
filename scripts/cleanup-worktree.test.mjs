import { describe, it, expect } from 'vitest';
import {
  isWorktreePath,
  resolveWorktreePath,
  parsePids,
  collectPids,
  findOrphanWorktrees,
} from './cleanup-worktree.mjs';

describe('isWorktreePath', () => {
  it('accepts a path under .claude/worktrees/', () => {
    expect(isWorktreePath('/repo/.claude/worktrees/feature-x')).toBe(true);
  });
  it('rejects the main checkout path', () => {
    expect(isWorktreePath('/repo')).toBe(false);
    expect(isWorktreePath('/repo/src/app.ts')).toBe(false);
  });
  it('rejects non-strings', () => {
    expect(isWorktreePath(undefined)).toBe(false);
  });
});

describe('resolveWorktreePath', () => {
  it('builds the worktree path from a bare name', () => {
    expect(resolveWorktreePath('feature-x', '/repo')).toBe(
      '/repo/.claude/worktrees/feature-x',
    );
  });
  it('returns an absolute path unchanged', () => {
    expect(
      resolveWorktreePath('/repo/.claude/worktrees/feature-x', '/repo'),
    ).toBe('/repo/.claude/worktrees/feature-x');
  });
});

describe('parsePids', () => {
  it('parses newline-separated pids and drops junk', () => {
    expect(parsePids('123\n456\n\n  789  \n')).toEqual([123, 456, 789]);
  });
  it('returns [] for empty output', () => {
    expect(parsePids('')).toEqual([]);
  });
});

describe('collectPids', () => {
  it('unions pgrep and lsof results, excluding self', () => {
    const run = (cmd) => {
      if (cmd.startsWith('pgrep')) return `100\n101\n${process.pid}\n`;
      if (cmd.includes('tcp:')) return '101\n202\n';
      return '';
    };
    const pids = collectPids(
      '/repo/.claude/worktrees/x',
      { devPort: 3002, previewPort: 3003 },
      run,
    );
    expect(pids).toEqual([100, 101, 202]);
    expect(pids).not.toContain(process.pid);
  });
});

describe('findOrphanWorktrees', () => {
  it('returns present dirs not tracked by git', () => {
    expect(findOrphanWorktrees(['a', 'b'], ['a', 'b', 'c', 'd'])).toEqual([
      'c',
      'd',
    ]);
  });
  it('returns [] when all dirs are tracked', () => {
    expect(findOrphanWorktrees(['a', 'b'], ['a', 'b'])).toEqual([]);
  });
});
