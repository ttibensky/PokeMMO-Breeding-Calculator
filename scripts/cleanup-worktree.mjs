// Terminates the node processes belonging to a single git worktree.
// Bare-node only (no npm deps): the WorktreeRemove hook may run this before
// node_modules exists. Imports only node:* and ./worktree-port.mjs.
import { join, isAbsolute, resolve } from 'node:path';

const WORKTREES_SEGMENT = '/.claude/worktrees/';

// True only for paths inside the worktrees dir — guards the main checkout.
export function isWorktreePath(p) {
  return typeof p === 'string' && p.includes(WORKTREES_SEGMENT);
}

// Resolve a CLI arg (bare worktree name OR a path) to an absolute worktree path.
export function resolveWorktreePath(nameOrPath, projectDir) {
  if (nameOrPath.includes('/')) {
    return isAbsolute(nameOrPath) ? nameOrPath : resolve(projectDir, nameOrPath);
  }
  return join(projectDir, '.claude', 'worktrees', nameOrPath);
}

// Parse newline-separated PID output into a clean array of positive ints.
export function parsePids(stdout) {
  return String(stdout)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
}

// Single-quote a string for safe shell interpolation.
export function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

// Collect PIDs belonging to a worktree: union of a path match (pgrep -f) and
// the worktree's two deterministic ports (lsof). `run(cmd)` returns stdout, or
// '' on no-match/error. Excludes this process and its parent.
export function collectPids(worktreePath, ports, run) {
  const pids = new Set();
  for (const pid of parsePids(run(`pgrep -f ${shellQuote(worktreePath)}`))) {
    pids.add(pid);
  }
  for (const port of [ports.devPort, ports.previewPort]) {
    for (const pid of parsePids(run(`lsof -ti tcp:${port}`))) pids.add(pid);
  }
  pids.delete(process.pid);
  pids.delete(process.ppid);
  return [...pids].sort((a, b) => a - b);
}

// Worktree dirs present on disk but no longer tracked by git.
export function findOrphanWorktrees(trackedNames, presentDirs) {
  const tracked = new Set(trackedNames);
  return presentDirs.filter((d) => !tracked.has(d));
}
