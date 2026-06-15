# `npm run kill:all` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `npm run kill:all`, a panic button that terminates all node processes from the main checkout **and** every worktree under `.claude/worktrees/`.

**Architecture:** Extend the existing `scripts/cleanup-worktree.mjs` with one new pure helper (`mainCheckoutTarget`), one new side-effecting helper (`cleanupMain`), and a new `--all` argv branch that kills the main checkout then sweeps every present worktree. Wire it to a `kill:all` npm script. Reuses the file's existing `collectPids` / `killPids` / `cleanupOne` / `presentWorktreeDirs` machinery.

**Tech Stack:** Plain Node ESM (`.mjs`, node:* only — no npm deps, because the WorktreeRemove hook may run before `node_modules` exists). Tests: Vitest (`npm run test:unit`).

---

## Why anchoring to `node_modules` matters (read before coding)

The main checkout's tools (vite, vitest, playwright, esbuild) run from
`<repoRoot>/node_modules/...`. A worktree's tools run from
`<repoRoot>/.claude/worktrees/<name>/node_modules/...`. The substring
`<repoRoot>/node_modules` therefore appears **only** in main-checkout command
lines (the worktree path diverges at `.claude`, not `node_modules`). Anchoring
the main `pgrep -f` pattern to `<repoRoot>/node_modules` is what keeps the
main-checkout kill from also matching worktrees, the editor's language server,
or the Claude session — all of which have different `node_modules` roots.

`collectPids` already deletes `process.pid` and `process.ppid`, so the command
never kills itself or its npm parent.

## File Structure

- **Modify** `scripts/cleanup-worktree.mjs` — add `mainCheckoutTarget()` (pure, exported), `cleanupMain()` (side-effecting), and an `--all` branch in `main()`.
- **Modify** `scripts/cleanup-worktree.test.mjs` — add unit tests for `mainCheckoutTarget` and a command-shape test proving the surgical `node_modules` anchoring + ports 3000/3001.
- **Modify** `package.json` — add the `"kill:all"` script.

---

## Task 1: `mainCheckoutTarget` helper (the surgical-targeting logic)

This is the only non-trivial new logic, so it gets TDD coverage: it decides
*what* to match for the main checkout (the `node_modules`-anchored path) and
*which* ports (3000/3001).

**Files:**
- Modify: `scripts/cleanup-worktree.mjs`
- Test: `scripts/cleanup-worktree.test.mjs`

- [ ] **Step 1: Write the failing tests**

Add this to `scripts/cleanup-worktree.test.mjs`. First add `mainCheckoutTarget`
to the existing import block at the top of the file so the import line becomes:

```javascript
import {
  isWorktreePath,
  resolveWorktreePath,
  projectRootOf,
  parsePids,
  collectPids,
  findOrphanWorktrees,
  mainCheckoutTarget,
} from './cleanup-worktree.mjs';
```

Then append these two `describe` blocks at the end of the file:

```javascript
describe('mainCheckoutTarget', () => {
  it('anchors the pgrep path to <root>/node_modules with the main ports', () => {
    expect(mainCheckoutTarget('/repo')).toEqual({
      path: '/repo/node_modules',
      ports: { devPort: 3000, previewPort: 3001 },
    });
  });
});

describe('collectPids — main checkout target', () => {
  it('pgreps <root>/node_modules and lsofs ports 3000 and 3001', () => {
    const cmds = [];
    const run = (cmd) => {
      cmds.push(cmd);
      return '';
    };
    const { path, ports } = mainCheckoutTarget('/repo');
    collectPids(path, ports, run);
    expect(cmds).toContain("pgrep -f '/repo/node_modules'");
    expect(cmds).toContain('lsof -ti tcp:3000');
    expect(cmds).toContain('lsof -ti tcp:3001');
  });

  it('does NOT pgrep the bare repo root (would match worktrees + unrelated tools)', () => {
    const cmds = [];
    const run = (cmd) => {
      cmds.push(cmd);
      return '';
    };
    const { path, ports } = mainCheckoutTarget('/repo');
    collectPids(path, ports, run);
    expect(cmds).not.toContain("pgrep -f '/repo'");
  });
});
```

> Note: `pgrep -f '/repo/node_modules'` uses single quotes because the file's
> `shellQuote` single-quote-escapes the path. The existing `collectPids` test
> already relies on this `run`-injection pattern.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:unit -- cleanup-worktree`
Expected: FAIL — `mainCheckoutTarget is not a function` (import is undefined).

- [ ] **Step 3: Write the minimal implementation**

In `scripts/cleanup-worktree.mjs`, add this exported helper. Place it directly
**above** the `cleanupOne` function (near the other exported helpers):

```javascript
// The pgrep path + lsof ports identifying the MAIN checkout's node processes.
// Anchored to <root>/node_modules so it matches only the main checkout — worktree
// tools live under .claude/worktrees/<name>/node_modules (path diverges at .claude).
export function mainCheckoutTarget(projectDir) {
  return {
    path: join(projectDir, 'node_modules'),
    ports: { devPort: 3000, previewPort: 3001 },
  };
}
```

(`join` is already imported from `node:path` at the top of the file.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:unit -- cleanup-worktree`
Expected: PASS — all `cleanup-worktree` tests green, including the three new ones.

- [ ] **Step 5: Commit**

```bash
git add scripts/cleanup-worktree.mjs scripts/cleanup-worktree.test.mjs
git commit -m "feat(scripts): add mainCheckoutTarget for kill:all main-checkout targeting"
```

---

## Task 2: `cleanupMain` + `--all` dispatch + `kill:all` script

This wires the pure helper into the side-effecting kill path and the CLI. The
`cleanupMain` helper and the `--all` branch are thin glue over already-tested
pieces (`collectPids`, `killPids`, `cleanupOne`, `presentWorktreeDirs`), so —
matching this file's existing convention where `cleanupOne`/`main` are not
unit-tested — they are verified by a manual smoke run in Step 5 rather than by
mocking the filesystem. (Stated explicitly per the testing rule: glue with
nothing pure left to assert is smoke-verified, not unit-tested.)

**Files:**
- Modify: `scripts/cleanup-worktree.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add the `cleanupMain` helper**

In `scripts/cleanup-worktree.mjs`, add this directly **below** the existing
`cleanupOne` function (it mirrors `cleanupOne`'s structure):

```javascript
// Clean the MAIN checkout: node processes under <root>/node_modules + the main
// dev/preview ports (3000/3001). Bypasses the isWorktreePath guard on purpose —
// this is the only path allowed to act on the main root, and only via the
// node_modules-anchored pattern from mainCheckoutTarget.
async function cleanupMain(projectDir) {
  const { path, ports } = mainCheckoutTarget(projectDir);
  const pids = collectPids(path, ports, shellRun);
  if (pids.length === 0) return; // quiet: nothing to kill
  await killPids(pids);
  console.log(
    `[cleanup] main: killed ${pids.length} procs (PIDs ${pids.join(', ')})`,
  );
}
```

- [ ] **Step 2: Add the `--all` branch to `main()`**

In `scripts/cleanup-worktree.mjs`, inside `main()`, insert this block
**immediately after** the `--stdin` block and **before** the
`if (args[0])` single-worktree block (it must come first so `--all` is not
mistaken for a worktree name):

```javascript
  // Kill-all mode: the main checkout + EVERY present worktree (not just orphans).
  if (args.includes('--all')) {
    const root = projectRootOf(projectDir);
    await cleanupMain(root);
    for (const name of presentWorktreeDirs(root)) {
      await cleanupOne(join(root, '.claude', 'worktrees', name));
    }
    return;
  }
```

(`projectRootOf`, `presentWorktreeDirs`, and `join` are all already defined/
imported in this file. `projectRootOf` normalizes the main root whether
`kill:all` is invoked from the main checkout or from inside a worktree.)

- [ ] **Step 3: Add the npm script**

In `package.json`, add this line to the `"scripts"` object, directly after the
existing `"cleanup:worktree"` entry:

```json
    "kill:all": "node scripts/cleanup-worktree.mjs --all",
```

(Match the surrounding indentation; ensure the preceding line keeps its trailing
comma and that JSON stays valid.)

- [ ] **Step 4: Run the unit suite to confirm nothing regressed**

Run: `npm run test:unit -- cleanup-worktree`
Expected: PASS — all `cleanup-worktree` tests still green (no new tests this task;
this confirms the edits didn't break the existing pure-helper tests).

- [ ] **Step 5: Smoke-test the real command**

Run: `npm run kill:all`
Expected: the command exits 0. With no dev servers/tests running it prints
nothing (or only `[cleanup] ...` lines if it actually killed something) and does
not error. Confirm it does not throw and does not hang beyond the ~3s SIGTERM
grace period.

Optional stronger check (only if you want to see it kill something): in a second
terminal run `npm run dev` (main checkout, port 3000), then run
`npm run kill:all` and confirm the dev server is terminated and a
`[cleanup] main: killed N procs ...` line is printed.

- [ ] **Step 6: Commit**

```bash
git add scripts/cleanup-worktree.mjs package.json
git commit -m "feat(scripts): add npm run kill:all to kill main + all worktree node procs"
```

---

## Task 3: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Run the full gate**

Run each and confirm green:

```bash
npm run test:unit
npm run typecheck
npm run lint
```

Expected: all pass. (`.mjs` scripts are not type-checked by `tsc -b`, but run
`typecheck` + `lint` anyway to confirm no incidental breakage. `test:e2e` is not
required — this is a build-tooling script with no app-behavior surface, so its
coverage is unit-level per the testing conventions.)

- [ ] **Step 2: Final commit (only if the gate produced fixes)**

If any lint/format autofix touched files:

```bash
git add -A
git commit -m "chore: lint/format fixes for kill:all"
```

---

## Self-review checklist (done while writing — for reference)

- **Spec coverage:** main-checkout kill → Task 1 (`mainCheckoutTarget`) + Task 2 (`cleanupMain`); all-worktrees sweep (not just orphans) → Task 2 `--all` branch using `presentWorktreeDirs` directly; npm script → Task 2 Step 3; surgical anchoring → Task 1 tests; self-exclusion → relies on existing `collectPids` behavior (noted, already tested). All spec requirements mapped.
- **Naming consistency:** `mainCheckoutTarget` and `cleanupMain` used identically in every task; `{ path, ports }` shape consistent between helper, tests, and `cleanupMain`.
- **No placeholders:** every code/edit step shows the exact code and exact command + expected output.
