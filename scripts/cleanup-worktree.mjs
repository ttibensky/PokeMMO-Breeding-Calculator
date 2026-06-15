// Terminates the node processes belonging to a single git worktree.
// Bare-node only (no npm deps): the WorktreeRemove hook may run this before
// node_modules exists. Imports only node:* and ./worktree-port.mjs.
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, isAbsolute, resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { portsForWorktree } from './worktree-port.mjs';

const WORKTREES_SEGMENT = '/.claude/worktrees/';

// True only for paths inside the worktrees dir — guards the main checkout.
export function isWorktreePath(p) {
  return typeof p === 'string' && p.includes(WORKTREES_SEGMENT);
}

// Normalize any path that is (or is inside) a worktree back to the main repo root.
export function projectRootOf(dir) {
  const i = String(dir).indexOf(WORKTREES_SEGMENT);
  return i === -1 ? dir : dir.slice(0, i);
}

// Resolve a CLI arg (bare worktree name OR a path) to an absolute worktree path.
export function resolveWorktreePath(nameOrPath, projectDir) {
  if (nameOrPath.includes('/')) {
    return isAbsolute(nameOrPath) ? nameOrPath : resolve(projectDir, nameOrPath);
  }
  return join(projectRootOf(projectDir), '.claude', 'worktrees', nameOrPath);
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

// The pgrep path + lsof ports identifying the MAIN checkout's node processes.
// Anchored to <root>/node_modules so it matches only the main checkout — worktree
// tools live under .claude/worktrees/<name>/node_modules (path diverges at .claude).
export function mainCheckoutTarget(projectDir) {
  return {
    path: join(projectDir, 'node_modules'),
    ports: { devPort: 3000, previewPort: 3001 },
  };
}

// --- imperative boundary (not unit-tested) ---

// Run a shell command, returning stdout or '' (pgrep/lsof exit non-zero when
// nothing matches — that is expected, not an error).
function shellRun(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// SIGTERM all pids, wait a grace period, then SIGKILL any survivors.
async function killPids(pids) {
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
  await sleep(3000);
  for (const pid of pids.filter(alive)) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // already gone
    }
  }
}

// Clean one worktree by absolute path. Refuses anything outside .claude/worktrees/.
async function cleanupOne(worktreePath) {
  if (!isWorktreePath(worktreePath)) {
    console.error(
      `[cleanup] refusing: ${worktreePath} is not under .claude/worktrees/`,
    );
    return;
  }
  const ports = portsForWorktree(basename(worktreePath));
  const pids = collectPids(worktreePath, ports, shellRun);
  if (pids.length === 0) return; // quiet: nothing to kill
  await killPids(pids);
  console.log(
    `[cleanup] ${basename(worktreePath)}: killed ${pids.length} procs (PIDs ${pids.join(', ')})`,
  );
}

// Basenames of worktrees git currently tracks under .claude/worktrees/.
function trackedWorktreeNames() {
  return shellRun('git worktree list --porcelain')
    .split('\n')
    .filter((l) => l.startsWith('worktree '))
    .map((l) => l.slice('worktree '.length).trim())
    .filter(isWorktreePath)
    .map((p) => basename(p));
}

// Directory names present under .claude/worktrees/.
function presentWorktreeDirs(projectDir) {
  const dir = join(projectDir, '.claude', 'worktrees');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

async function main() {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const args = process.argv.slice(2);

  // Hook mode: read worktree_path from stdin JSON (WorktreeRemove event).
  if (args.includes('--stdin')) {
    let payload = {};
    try {
      const raw = readFileSync(0, 'utf8');
      if (raw.trim()) payload = JSON.parse(raw);
    } catch {
      // no/invalid stdin
    }
    if (payload.worktree_path) await cleanupOne(payload.worktree_path);
    return;
  }

  // Single-worktree mode: a name or path argument.
  if (args[0]) {
    await cleanupOne(resolveWorktreePath(args[0], projectDir));
    return;
  }

  // No-arg mode: sweep orphans (dirs present but untracked by git).
  const orphans = findOrphanWorktrees(
    trackedWorktreeNames(),
    presentWorktreeDirs(projectDir),
  );
  for (const name of orphans) {
    await cleanupOne(join(projectDir, '.claude', 'worktrees', name));
  }
}

// Run only when executed directly (not when imported by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
