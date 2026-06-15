# `npm run kill:all` — kill all node processes from this repo and every worktree

## Problem

The repo has `npm run cleanup:worktree` (backed by `scripts/cleanup-worktree.mjs`)
to terminate node processes for a single worktree, plus a no-arg orphan-sweep
mode. But there is no single "panic button" that kills **everything** node-related
spawned by this repository: the main checkout's dev/preview/test processes are
deliberately out of scope (the script refuses any path not under
`.claude/worktrees/`), and the no-arg sweep only targets git-*orphan* worktrees.

We want one command that kills the main checkout's processes **and** every present
worktree's processes in one shot.

## Goal

`npm run kill:all` terminates all node processes (dev server, preview server,
vitest, playwright/esbuild workers) belonging to:

- the **main checkout** (dev `:3000`, preview `:3001`, and its `node_modules` tools), and
- **every** worktree directory present under `.claude/worktrees/` (not just git-orphans).

It must not kill unrelated tooling (the editor's language server, the Claude
session itself) and must never kill itself.

## Approach (chosen)

Extend the existing `scripts/cleanup-worktree.mjs` with a new `--all` dispatch
branch and wire a `kill:all` npm script to it. This reuses the already-tested
machinery (`collectPids`, `killPids`, `portsForWorktree`, `presentWorktreeDirs`,
`shellRun`) and keeps every process-killing path in one file alongside its
existing test suite.

Rejected alternatives:

- **New standalone `scripts/kill-all.mjs`** — `killPids`/`shellRun`/`alive` aren't
  exported today, so this needs a refactor (export them) or duplication, for no
  behavioral gain.
- **npm script chaining existing commands** — doesn't work: the no-arg sweep only
  kills orphan worktrees and nothing kills the main checkout.

## Design

### Command

```jsonc
// package.json "scripts"
"kill:all": "node scripts/cleanup-worktree.mjs --all"
```

### Behavior

`main()` gains a `--all` branch (alongside `--stdin`, single-arg, and no-arg):

1. **Resolve the main repo root** via `git rev-parse --git-common-dir` and take its
   parent, so `kill:all` works whether invoked from the main checkout or from
   inside a worktree.

2. **Kill the main checkout** (`cleanupMain(projectDir)` — a new helper):
   - Collect PIDs via `pgrep -f "<repoRoot>/node_modules"` **plus** `lsof` on
     `:3000` and `:3001`.
   - Anchoring the pgrep pattern to `<repoRoot>/node_modules` is what keeps it
     surgical: worktree tools run from
     `<repoRoot>/.claude/worktrees/<name>/node_modules` (the path diverges at
     `.claude`, not `node_modules`), so this matches **only** the main checkout —
     not worktrees, not the editor's language server, not the Claude session
     (all have different `node_modules` roots).
   - `killPids` the result (SIGTERM → wait 3s → SIGKILL survivors).
   - This intentionally bypasses the `isWorktreePath` guard that `cleanupOne` uses;
     `cleanupMain` is the only path allowed to act on the main root, and only via
     the `node_modules`-anchored pattern + the two known ports.

3. **Kill every present worktree**: iterate **all** dirs from
   `presentWorktreeDirs(projectDir)` (not filtered through `findOrphanWorktrees`)
   and call the existing `cleanupOne(resolveWorktreePath(name, projectDir))` for
   each — reusing the per-worktree kill (`pgrep -f <worktreePath>` + `lsof` on its
   `portsForWorktree(name)` pair).

4. **Print a summary** of what was killed (per-target PID counts), consistent with
   the script's existing logging.

### Data flow

```
npm run kill:all
  └─ node scripts/cleanup-worktree.mjs --all
       ├─ projectDir = parent(git rev-parse --git-common-dir)
       ├─ cleanupMain(projectDir)
       │     ├─ collectPids("<projectDir>/node_modules", [3000, 3001], shellRun)
       │     └─ killPids(pids)            // SIGTERM → 3s → SIGKILL
       └─ for name of presentWorktreeDirs(projectDir):
             cleanupOne(resolveWorktreePath(name, projectDir))
```

### Safety properties

- **Never kills itself**: `killPids` already excludes `process.pid` / `process.ppid`.
- **Scoped to this repo**: main pgrep anchored to `<repoRoot>/node_modules`; worktree
  pgrep anchored to each worktree path; `lsof` only on this repo's known ports.
- **Destructive by design**: no confirmation prompt — it's a panic button. It *will*
  kill an actively-used dev server / vitest watch / playwright run. That is intended.

### Decisions / non-goals (YAGNI)

- **Ports stay hardcoded `3000` / `3001`** for the main checkout — consistent with the
  rest of the cleanup tooling, which does not read `DEV_PORT` / `PREVIEW_PORT`. Not
  honoring those env overrides here is a deliberate scope cut.
- **No dry-run / confirmation flag** — out of scope for a panic button.

## Testing

Extend `scripts/cleanup-worktree.test.mjs` (which injects a fake `run` callback, so
no real processes are spawned). Add coverage for:

1. The `--all` branch collects the **main** target: `pgrep -f` on
   `<repoRoot>/node_modules` and `lsof` on ports `3000` and `3001`.
2. The `--all` branch sweeps **all** present worktree dirs (not only git-orphans) —
   i.e. a present-but-tracked worktree is still killed.
3. Self-exclusion holds (the running pid/ppid are never in the kill set).

Verifier gate: `test:unit` + `test:e2e` + `tsc -b` + `eslint .` all green. (No e2e is
expected for a build-tooling script; unit/`.mjs` tests cover it.)

## Files touched

- `scripts/cleanup-worktree.mjs` — add `cleanupMain()` helper + `--all` dispatch branch.
- `scripts/cleanup-worktree.test.mjs` — add `--all` coverage.
- `package.json` — add `"kill:all"` script.
