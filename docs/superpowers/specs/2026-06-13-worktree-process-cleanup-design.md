# Worktree process cleanup — design

**Date:** 2026-06-13
**Status:** Approved (brainstorming)

## Problem

Each Claude Code worktree under `.claude/worktrees/` spawns node processes (Vite
dev server, preview server, `vitest` workers, the `esbuild` service). A
`SessionStart` hook (`scripts/setup-worktree.mjs`) *sets these up* — installs
deps and assigns a deterministic port pair per worktree — but **nothing tears
them down**. When a worktree's session ends, is merged, or crashes, its node
processes keep running. They accumulate across sessions and eventually exhaust
memory/CPU (observed: 18 orphaned `vitest` workers holding ~2 GB, plus a stray
`esbuild` from an untracked `/private/tmp/premerge-check` worktree).

## Goal

When a worktree is torn down, or its branch is merged / a PR is created,
reliably terminate **all** node processes belonging to that worktree — and
**never** touch the main checkout's processes.

## Key facts the design relies on

- **Deterministic ports.** `scripts/worktree-port.mjs` exports
  `portsForWorktree(name)`, which hashes the worktree basename into a
  `{ devPort, previewPort }` pair (dev = even 3002–3180, preview = dev+1).
  `setup-worktree.mjs` writes these into the worktree's `.env.local`. The same
  function gives cleanup the ports to target — single source of truth.
- **Unique path.** Worktrees live at the unique subpath
  `<project>/.claude/worktrees/<name>`. Matching that subpath cannot collide
  with main-checkout processes (main is the parent dir, not a substring of the
  worktree subpath).
- **`WorktreeRemove` hook.** Claude Code fires a `WorktreeRemove` hook when a
  worktree is removed, passing `worktree_path` / `worktree_name` on stdin JSON.
  This is the automatic teardown trigger.
- **Vitest workers bind no port.** `vitest run` workers communicate over IPC,
  not TCP — so a port-only strategy misses them. They must be found by path.

## Identification strategy: hybrid (path ∪ ports)

Find the worktree's PIDs as the **union** of:

1. **Path match** — `pgrep -f <absolute worktree path>`: catches node, `vitest`
   workers, and the `esbuild` service, all of which carry the worktree path in
   their argv or cwd. This is what catches the leaks a port scan misses.
2. **Port match** — `lsof -ti tcp:<devPort>` and `tcp:<previewPort>` (ports from
   `portsForWorktree`): catches any detached dev/preview/Playwright server that
   somehow lacks the path in its argv.

Rationale: path-only would normally suffice, but the port scan is a cheap
belt-and-braces for detached servers. Port-only was rejected because it misses
vitest workers (the actual observed leak).

## Components

### 1. `scripts/cleanup-worktree.mjs` — the kill engine

- **Input:** a worktree name or path as a CLI arg, **or** `--stdin` to read
  `worktree_path` from a hook's stdin JSON.
- **Hard safety guard:** the resolved absolute path **must** contain
  `/.claude/worktrees/`. If it resolves to the main checkout (or anything
  outside that subtree), the script logs a refusal and exits 0 without killing
  anything. This guarantees it can never kill the user's real dev session.
- **Identify:** union of `pgrep -f <abs path>` and `lsof -ti` on the two ports
  from `portsForWorktree(name)`. Exclude the script's own PID and its parent.
- **Terminate:** `SIGTERM` all matched PIDs → wait ~3s grace → `SIGKILL` any
  survivors. Idempotent; a clean no-op when nothing matches.
- **Logging (quiet summary):** one line on action, e.g.
  `[cleanup] worktree-X: killed 4 procs (PIDs 1,2,3,4)`. Silent when there's
  nothing to kill. Errors still print.

### 2. `WorktreeRemove` hook (`.claude/settings.json`)

A `WorktreeRemove` hook block runs
`node "$CLAUDE_PROJECT_DIR/scripts/cleanup-worktree.mjs" --stdin`, piping the
hook's JSON in. Automatic "on worktree removal" trigger.

### 3. Finish-time integration (`.claude/rules/`)

A short rule instructing the `finishing-a-development-branch` flow to run
`npm run cleanup:worktree <name>` right after a merge to main / PR creation.
This covers the case where the worktree dir is **kept** on disk after merge, so
`WorktreeRemove` never fires.

### 4. `npm run cleanup:worktree`

- `npm run cleanup:worktree <name|path>` → clean one worktree (wraps the engine).
- `npm run cleanup:worktree` (no arg) → **manual** sweep: for every
  `.claude/worktrees/*` directory that `git worktree list` no longer tracks (or
  whose dir is gone), run the engine. This is a manual command only — never
  scheduled. It is also what clears the current orphan backlog.

### 5. README section

A "Worktree cleanup" section documenting: what it does, the automatic triggers
(`WorktreeRemove` hook + finish-time), and the manual commands
(`npm run cleanup:worktree [name]`).

### 6. Tests (Vitest, `*.test.mjs` to match `worktree-port.test.mjs`)

Unit-test the **pure decision logic**, mocking the `pgrep`/`lsof`/kill boundary
so no real processes are touched:

- Safety guard: rejects the main checkout path; accepts a
  `.claude/worktrees/<name>` path.
- Name→port mapping delegates to `portsForWorktree` (no duplicated hashing).
- Orphan detection: given a set of git-tracked worktrees and a set of on-disk
  dirs, the no-arg sweep selects exactly the untracked/orphaned ones.

## Remediation (after build + verification)

Once the mechanism is built and the suite is green, use it to clear the current
mess: `npm run cleanup:worktree` (sweep orphans), then `git worktree prune`, and
remove the untracked `/private/tmp/premerge-check` worktree.

## Out of scope

- No periodic/scheduled reaper (explicitly declined — manual sweep only).
- No change to how ports are assigned or how `setup-worktree.mjs` works.
