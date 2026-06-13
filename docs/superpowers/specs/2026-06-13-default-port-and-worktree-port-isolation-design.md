# Default dev port + per-worktree port isolation

**Date:** 2026-06-13
**Status:** Approved design, pre-implementation

## Problem

The main checkout's dev server runs on Vite's default **5173** and the preview/e2e
server on **4173** (hardcoded in `playwright.config.ts`). Git worktrees under
`.claude/worktrees/` are full copies that all hardcode the same ports, so running
the app (or e2e) from two worktrees at once **collides on the same port**. There is
also no setup step on worktree creation, so a fresh worktree has no
`node_modules` and the app won't run until someone manually installs.

## Goals

1. The **main checkout** runs the dev app on port **3000** (preview/e2e on **3001**).
2. Every **future worktree** automatically:
   - runs `npm install` so the app works, and
   - gets a **distinct port pair** so concurrent worktrees never collide.

## Non-goals

- Changing any behavior of the app itself.
- Touching historical `4173` references outside `playwright.config.ts` (e.g. the
  note in `docs/superpowers/plans/2026-06-13-remove-owned-page-add-button.md`),
  which stays as a historical record.
- A central port registry / allocator service. Allocation is stateless (see below).

## Architecture

One idempotent setup script, wired to whichever worktree/session trigger fires,
plus committed config that reads ports from the environment with main's values as
defaults.

### 1. Config reads ports from env (defaults = main's ports)

- `vite.config.ts`
  - `server.port = Number(process.env.DEV_PORT) || 3000`
  - `preview.port = Number(process.env.PREVIEW_PORT) || 3001`
  - `server.strictPort = true` and `preview.strictPort = true` — fail loudly on a
    busy port rather than silently drifting to another one.
  - Env is read via Vite's `loadEnv` so a per-worktree `.env` is picked up whether
    the server is launched by the agent or by a human in their own terminal.
- `playwright.config.ts`
  - Replace hardcoded `4173` in `baseURL` and `webServer.url` with a value derived
    from `PREVIEW_PORT` (default `3001`).
  - Playwright does **not** auto-load `.env`, so the config explicitly loads it
    (small `dotenv`/manual parse at the top).

Net effect: the main checkout with no env set runs dev on **3000**, preview/e2e on
**3001**.

### 2. Setup script — `.claude/hooks/setup-worktree.sh` (idempotent)

Safe to run repeatedly. On each run:

1. If cwd is under `.claude/worktrees/` **and** `node_modules` is missing →
   run `npm install`.
2. Compute this worktree's distinct port pair (see allocation below) and write a
   per-worktree `.env` with `DEV_PORT` / `PREVIEW_PORT`. The main checkout is not
   under `.claude/worktrees/`, so the script writes nothing there → defaults apply.

The script delegates the actual port math to a tiny pure JS module so the logic is
unit-testable (not trapped in bash):

- `scripts/worktree-port.mjs` exports `portsForWorktree(name) -> { devPort, previewPort }`.
- The shell script calls it (`node scripts/worktree-port.mjs <name>`) to get the values.

### 3. Hook wiring — `.claude/settings.json`

Register `setup-worktree.sh` on **both** `WorktreeCreate` and `SessionStart`.

Rationale and open uncertainty: the `EnterWorktree` tool docs describe
`WorktreeCreate`/`WorktreeRemove` as the mechanism for *non-git* isolation; inside
a git repo the tool creates the worktree itself, and it switches the *current*
session's cwd rather than starting a new session — so it is **not confirmed** that
either hook fires for git-repo worktree creation in this harness. Because the
script is idempotent, wiring both is safe: whichever fires sets the worktree up,
and double-firing is harmless. **Implementation will verify empirically which hook
actually fires and trim any dead wiring.** A `SessionStart` guard restricts work to
cwds under `.claude/worktrees/` so it is a no-op for normal main-checkout sessions.

## Port allocation (stateless, deterministic)

Derived from a hash of the worktree directory name — no central counter, no
locking, no shared mutable state:

```
slot         = (hash(worktree_name) mod 90) + 1     # 1..90
DEV_PORT     = 3000 + slot*2                          # even: 3002, 3004, … 3180
PREVIEW_PORT = DEV_PORT + 1                            # odd partner
```

- Same worktree name → same ports every session (repeatable).
- Trade-off: two differently-named worktrees could hash to the same slot
  (birthday collision). With a handful of live worktrees the odds are tiny, and the
  failure mode is **loud** (`strictPort` → "port in use"), not silent corruption.
  Chosen over a locked counter file, which is collision-free but adds shared mutable
  state and locking for a rarely-hit problem.

## Testing

Per the project testing policy: e2e for behavioral/observable changes, unit tests
for pure logic.

- **Port derivation** (`scripts/worktree-port.mjs`) — Vitest unit tests:
  determinism (same name → same ports), even-dev / odd-preview invariant, range
  bounds, distinctness of dev vs preview.
- **vite.config default** — unit assertion that with no env it resolves to
  `3000` / `3001`.
- **e2e** — the existing Playwright suite passing against env-driven `3001` on the
  main checkout is the proof the `PREVIEW_PORT` plumbing works
  (`npm run test:e2e`, gated by the verifier).
- Full gate before "done": `test:unit` + `test:e2e` + `tsc -b` + `eslint .`.

## Gitignore & cleanup

- Add the per-worktree `.env` pattern to `.gitignore` so it is never committed from
  any checkout.
- Worktree removal takes its directory (`.env`, `node_modules`) with it; allocation
  is stateless so there is nothing to "free" — no `WorktreeRemove` cleanup hook
  expected. Flag if that turns out to be wrong.

## Files touched

- `vite.config.ts` — env-driven `server.port` / `preview.port` + `strictPort`.
- `playwright.config.ts` — env-driven port, load `.env`.
- `scripts/worktree-port.mjs` (new) — pure port-derivation function.
- `scripts/worktree-port.test.ts` (new) — unit tests.
- `.claude/hooks/setup-worktree.sh` (new) — idempotent install + `.env` writer.
- `.claude/settings.json` — register hook on `WorktreeCreate` + `SessionStart`.
- `.gitignore` — ignore per-worktree `.env`.
