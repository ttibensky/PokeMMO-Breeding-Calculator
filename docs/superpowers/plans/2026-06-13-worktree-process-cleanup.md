# Worktree Process Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Terminate all node processes belonging to a git worktree when it is removed or its branch is merged/PR'd, so they stop leaking memory and CPU.

**Architecture:** A bare-node script (`scripts/cleanup-worktree.mjs`) identifies a worktree's processes as the union of a path match (`pgrep -f <worktree path>`, which catches `vitest` IPC workers and `esbuild`) and its two deterministic ports (`lsof`, reusing `portsForWorktree` from `scripts/worktree-port.mjs`), then SIGTERM→grace→SIGKILLs them. A hard guard refuses any path outside `.claude/worktrees/`, so the main checkout is never touched. It is wired to fire automatically via a `WorktreeRemove` hook and at merge/PR-finish time, and is also runnable manually.

**Tech Stack:** Node ESM (`.mjs`, bare-node — no npm deps, matches `setup-worktree.mjs`), Vitest (`*.test.mjs`), Claude Code hooks (`.claude/settings.json`).

---

## File Structure

- **Create** `scripts/cleanup-worktree.mjs` — the cleanup engine. Pure helpers (path guard, name→path, PID parsing, PID collection, orphan detection) + a thin imperative runner (shell exec, kill with grace period, CLI/stdin/sweep dispatch).
- **Create** `scripts/cleanup-worktree.test.mjs` — Vitest unit tests for the pure helpers, mocking the `pgrep`/`lsof` boundary so no real processes are touched.
- **Modify** `.claude/settings.json` — add a `WorktreeRemove` hook block.
- **Modify** `package.json` — add the `cleanup:worktree` script.
- **Create** `.claude/rules/worktree-cleanup.md` — finish-time integration rule.
- **Modify** `README.md` — add a "Worktree cleanup" section.

The engine separates **pure decision logic** (unit-tested) from the **imperative boundary** (shell exec + `process.kill`, manually verified). This keeps tests fast and side-effect-free.

---

### Task 1: Cleanup engine — pure helpers (TDD)

**Files:**
- Create: `scripts/cleanup-worktree.mjs`
- Test: `scripts/cleanup-worktree.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `scripts/cleanup-worktree.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:unit -- scripts/cleanup-worktree.test.mjs`
Expected: FAIL — cannot resolve `./cleanup-worktree.mjs` (module does not exist).

- [ ] **Step 3: Write the pure helpers**

Create `scripts/cleanup-worktree.mjs`:

```js
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:unit -- scripts/cleanup-worktree.test.mjs`
Expected: PASS — all 11 assertions green.

- [ ] **Step 5: Commit**

```bash
git add scripts/cleanup-worktree.mjs scripts/cleanup-worktree.test.mjs
git commit -m "feat: add worktree cleanup pure helpers with tests"
```

---

### Task 2: Cleanup engine — imperative runner

**Files:**
- Modify: `scripts/cleanup-worktree.mjs` (append imports + imperative code)

- [ ] **Step 1: Extend the import line**

Replace the first import line:

```js
import { join, isAbsolute, resolve } from 'node:path';
```

with the full import set the runner needs:

```js
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, isAbsolute, resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { portsForWorktree } from './worktree-port.mjs';
```

- [ ] **Step 2: Append the imperative runner**

Append to the end of `scripts/cleanup-worktree.mjs`:

```js
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
```

- [ ] **Step 3: Verify the unit tests still pass (no regression from the new code)**

Run: `npm run test:unit -- scripts/cleanup-worktree.test.mjs`
Expected: PASS — the `import.meta.url` guard keeps `main()` from running during import, so the same 11 assertions stay green.

- [ ] **Step 4: Manually verify the safety guard and no-op behavior**

Run (refusal on a non-worktree path):
```bash
node scripts/cleanup-worktree.mjs /tmp/not-a-worktree
```
Expected: prints `[cleanup] refusing: /tmp/not-a-worktree is not under .claude/worktrees/`, exits 0, kills nothing.

Run (no-op on a worktree path with no live processes):
```bash
node scripts/cleanup-worktree.mjs nonexistent-worktree
```
Expected: no output (quiet — nothing to kill), exits 0.

Run (stdin/hook mode is inert with no path):
```bash
echo '{}' | node scripts/cleanup-worktree.mjs --stdin
```
Expected: no output, exits 0.

- [ ] **Step 5: Commit**

```bash
git add scripts/cleanup-worktree.mjs
git commit -m "feat: add worktree cleanup runner (hook/cli/sweep modes)"
```

---

### Task 3: Wire the WorktreeRemove hook + npm script

**Files:**
- Modify: `.claude/settings.json`
- Modify: `package.json:6-15` (scripts block)

- [ ] **Step 1: Add the WorktreeRemove hook**

In `.claude/settings.json`, the `hooks` object currently contains only
`SessionStart`. Add a sibling `WorktreeRemove` entry so the `hooks` object reads:

```json
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/scripts/setup-worktree.mjs\"",
            "timeout": 300
          }
        ]
      }
    ],
    "WorktreeRemove": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/scripts/cleanup-worktree.mjs\" --stdin",
            "timeout": 30
          }
        ]
      }
    ]
  }
```

- [ ] **Step 2: Add the npm script**

In `package.json`, add to the `scripts` block (after `"build:dataset"`):

```json
    "build:dataset": "tsx scripts/build-dataset.ts",
    "cleanup:worktree": "node scripts/cleanup-worktree.mjs"
```

(Add a comma after the `build:dataset` line; `cleanup:worktree` is the last entry, no trailing comma.)

- [ ] **Step 3: Verify the JSON files are valid**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8')); JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('ok')"
```
Expected: prints `ok`.

- [ ] **Step 4: Verify the npm script resolves**

Run:
```bash
npm run cleanup:worktree -- /tmp/not-a-worktree
```
Expected: prints the `[cleanup] refusing:` line and exits 0 (confirms `npm run … -- <arg>` forwards the argument).

- [ ] **Step 5: Commit**

```bash
git add .claude/settings.json package.json
git commit -m "feat: trigger worktree cleanup via WorktreeRemove hook and npm script"
```

---

### Task 4: Finish-time integration rule

**Files:**
- Create: `.claude/rules/worktree-cleanup.md`

- [ ] **Step 1: Write the rule**

Create `.claude/rules/worktree-cleanup.md`:

```markdown
# Worktree cleanup at finish time

When a worktree's branch is merged to `main` or a PR is created (e.g. during the
`superpowers:finishing-a-development-branch` flow), the worktree's node processes
(dev/preview servers, vitest workers, esbuild) must be terminated — otherwise
they leak memory and CPU.

- **On worktree removal:** handled automatically by the `WorktreeRemove` hook in
  `.claude/settings.json`, which runs `scripts/cleanup-worktree.mjs --stdin`.
- **On merge/PR where the worktree dir is kept:** the `WorktreeRemove` hook does
  NOT fire, so run cleanup explicitly as the final step:

  ```bash
  npm run cleanup:worktree -- <worktree-name>
  ```

  Use the worktree's directory name under `.claude/worktrees/` (e.g.
  `worktree-process-cleanup`).
```

- [ ] **Step 2: Commit**

```bash
git add .claude/rules/worktree-cleanup.md
git commit -m "docs: add finish-time worktree cleanup rule"
```

---

### Task 5: README documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read the README to find a sensible insertion point**

Run: `cat README.md`
Pick a location after any existing development/scripts section (append a new
top-level section at the end if there is no obvious home).

- [ ] **Step 2: Add the "Worktree cleanup" section**

Insert this section into `README.md`:

```markdown
## Worktree cleanup

Each Claude Code worktree (`.claude/worktrees/<name>`) runs its own node
processes — a Vite dev server, a preview server, `vitest` workers, and the
`esbuild` service — on a port pair derived from the worktree name. These are
terminated automatically when the worktree goes away, and can be cleaned up by
hand.

**Automatic triggers:**

- **Worktree removed** — a `WorktreeRemove` hook (`.claude/settings.json`) runs
  `scripts/cleanup-worktree.mjs` and kills that worktree's processes.
- **Merged / PR created** — the finishing flow runs the cleanup explicitly (see
  `.claude/rules/worktree-cleanup.md`), covering the case where the worktree
  directory is kept on disk after merging.

**Manual triggers:**

```bash
# Clean one worktree by its directory name (or path):
npm run cleanup:worktree -- <worktree-name>

# Sweep every worktree directory git no longer tracks (orphan cleanup):
npm run cleanup:worktree
```

The script only ever touches processes under `.claude/worktrees/` — it refuses
to run against the main checkout, so your primary dev server is never affected.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document worktree cleanup usage in README"
```

---

### Task 6: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit suite**

Run: `npm run test:unit`
Expected: PASS — including the existing `worktree-port.test.mjs` and the new
`cleanup-worktree.test.mjs`.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (the new `.mjs` files are not part of the TS build; nothing
should regress).

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS — `cleanup-worktree.mjs` follows the same bare-node ESM style as
`setup-worktree.mjs`/`worktree-port.mjs`.

- [ ] **Step 4: Confirm clean tree**

Run: `git status`
Expected: working tree clean, all task commits present.

---

## Post-plan remediation (operational, performed with the user after the gate is green)

After the suite is green, use the new tooling to clear the current backlog:

1. `npm run cleanup:worktree` — sweep any orphaned (untracked) worktree dirs.
2. `git worktree prune` — drop stale git worktree registrations.
3. Manually terminate strays that live **outside** `.claude/worktrees/` and so
   are out of the tool's scope — notably the `~18 vitest` workers and the
   `esbuild` from the untracked `/private/tmp/premerge-check` worktree — then
   `git worktree remove --force /private/tmp/premerge-check` (or delete the dir).

This step is operational, not a code task; confirm process IDs with the user
before killing anything outside the worktree system.

---

## Self-Review

- **Spec coverage:** kill engine (Tasks 1–2), `.claude/worktrees/` safety guard
  (Task 1 `isWorktreePath` + Task 2 `cleanupOne`), hybrid path∪port
  identification (Task 1 `collectPids`), reuse of `portsForWorktree` (Task 2),
  SIGTERM→grace→SIGKILL (Task 2 `killPids`), quiet-summary logging (Task 2),
  `WorktreeRemove` hook (Task 3), finish-time integration (Task 4), npm command
  with no-arg orphan sweep (Tasks 2–3), README docs (Task 5), Vitest tests for
  pure logic (Task 1), remediation (post-plan section). All spec sections map to
  a task.
- **Placeholders:** none — every code/JSON step shows complete content.
- **Type/name consistency:** `isWorktreePath`, `resolveWorktreePath`,
  `parsePids`, `shellQuote`, `collectPids`, `findOrphanWorktrees`,
  `portsForWorktree({ devPort, previewPort })`, `cleanupOne`, `killPids` are
  used consistently across tasks and match the test imports.
