# Default dev port 3000 + per-worktree port isolation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the main checkout run the dev server on port 3000 (preview/e2e on 3001), and make every future git worktree automatically `npm install` and pick a distinct, collision-free port pair.

**Architecture:** Committed config (`vite.config.ts`, `playwright.config.ts`) reads ports from the environment / a per-worktree `.env.local`, falling back to 3000/3001 (main's ports). A zero-dependency Node script (`scripts/setup-worktree.mjs`) installs deps and writes the worktree's `.env.local` with a deterministic, hash-derived port pair. A `SessionStart` hook runs that script automatically for worktree sessions.

**Tech Stack:** Vite 6, Vitest 3, Playwright 1.52, Node ESM (`.mjs`), TypeScript 5.8.

---

## Refinements vs. the spec (read first)

The spec (`docs/superpowers/specs/2026-06-13-default-port-and-worktree-port-isolation-design.md`) is the source of intent. Three concrete refinements were locked in while inspecting the codebase:

1. **Per-worktree file is `.env.local`, not `.env`.** `.gitignore` already ignores `*.local` (so `.env.local` is covered with **no gitignore change**), and `.claude/settings.json` treats `.env`/`.env.*` as secrets via a deny-list. `.env.local` is loaded by Vite's `loadEnv` and is machine-local by convention. **No `.gitignore` edit is needed** — Task 5 verifies this.
2. **No `dotenv` dependency.** Playwright reads `.env.local` with a tiny inline parse; Vite uses its built-in `loadEnv`.
3. **Setup is a Node `.mjs`, not bash, and the hook is `SessionStart`-first.** The script must run with bare `node` *before* `npm install` (so no `tsx`/TS, no deps). `SessionStart` fires for fresh sessions in a worktree and has no stdout contract. `WorktreeCreate` is left as a conditional follow-up (Task 6) because its firing inside a git repo and its stdout-path contract are unverified — the script is built to not depend on it.

---

## File structure

- `scripts/worktree-port.mjs` *(new)* — pure `portsForWorktree(name)`; the single source of port math. Runnable by bare `node`, invisible to `tsc`.
- `scripts/worktree-port.test.mjs` *(new)* — Vitest unit tests for the port math.
- `scripts/setup-worktree.mjs` *(new)* — reads hook stdin, runs `npm install` if needed, writes `.env.local`.
- `vite.config.ts` *(modify)* — env-driven `server.port`/`preview.port` + `strictPort`.
- `playwright.config.ts` *(modify)* — env-driven port from `PREVIEW_PORT`/`.env.local`.
- `.claude/settings.json` *(modify)* — add a `SessionStart` hook alongside existing `permissions`.

---

## Task 1: Pure port-derivation module (TDD)

**Files:**
- Create: `scripts/worktree-port.mjs`
- Test: `scripts/worktree-port.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `scripts/worktree-port.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { portsForWorktree } from './worktree-port.mjs';

describe('portsForWorktree', () => {
  it('is deterministic for the same name', () => {
    expect(portsForWorktree('feature-x')).toEqual(portsForWorktree('feature-x'));
  });

  it('returns an even dev port and the next odd preview port', () => {
    const { devPort, previewPort } = portsForWorktree('feature-x');
    expect(devPort % 2).toBe(0);
    expect(previewPort).toBe(devPort + 1);
  });

  it('keeps ports inside the reserved worktree range', () => {
    for (const name of ['a', 'feature-x', 'worktree-port-isolation', 'zzz-very-long-name']) {
      const { devPort, previewPort } = portsForWorktree(name);
      expect(devPort).toBeGreaterThanOrEqual(3002);
      expect(devPort).toBeLessThanOrEqual(3180);
      expect(previewPort).toBeGreaterThanOrEqual(3003);
      expect(previewPort).toBeLessThanOrEqual(3181);
    }
  });

  it('never collides with the main checkout ports (3000/3001)', () => {
    const { devPort, previewPort } = portsForWorktree('any-name');
    expect(devPort).not.toBe(3000);
    expect(previewPort).not.toBe(3001);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- scripts/worktree-port.test.mjs`
Expected: FAIL — `Failed to resolve import "./worktree-port.mjs"` (module does not exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `scripts/worktree-port.mjs`:

```js
// Deterministic, stateless port assignment for git worktrees.
// Main checkout (not a worktree) uses 3000/3001 — see vite.config.ts defaults.
// Each worktree hashes its directory name into a distinct even/odd port pair.
export function portsForWorktree(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (Math.imul(hash, 31) + name.charCodeAt(i)) >>> 0;
  }
  const slot = (hash % 90) + 1; // 1..90
  const devPort = 3000 + slot * 2; // even: 3002, 3004, … 3180
  return { devPort, previewPort: devPort + 1 };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit -- scripts/worktree-port.test.mjs`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Confirm `tsc -b` ignores the new `.mjs` files**

Run: `npm run typecheck`
Expected: PASS — no errors (`.mjs` files are not part of the TS build graph).

- [ ] **Step 6: Commit**

```bash
git add scripts/worktree-port.mjs scripts/worktree-port.test.mjs
git commit -m "feat: deterministic per-worktree port derivation"
```

---

## Task 2: Env-driven ports in vite.config.ts

**Files:**
- Modify: `vite.config.ts` (full file shown below)

- [ ] **Step 1: Replace the config with the env-driven version**

Current `vite.config.ts` exports a static object. Replace the entire file with the function form below (it reads `.env.local`/process env via Vite's `loadEnv`, defaults to 3000/3001, and keeps the existing `base`, `build`, and `test` blocks unchanged):

```ts
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devPort = Number(env.DEV_PORT) || 3000;
  const previewPort = Number(env.PREVIEW_PORT) || 3001;

  return {
    plugins: [react()],
    base: '/PokeMMO-Breeding-Calculator/',
    build: {
      // The bundled Pokémon dataset JSON (~1.5 MB) is intentionally large;
      // raise the warning threshold so the build doesn't flag it as unexpected.
      chunkSizeWarningLimit: 2000,
    },
    server: {
      port: devPort,
      strictPort: true,
    },
    preview: {
      port: previewPort,
      strictPort: true,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test-setup.ts'],
      exclude: ['e2e/**', 'node_modules/**', '.claude/**'],
    },
  };
});
```

- [ ] **Step 2: Verify the unit suite still runs under the new config form**

Run: `npm run test:unit`
Expected: PASS — the full Vitest suite (including Task 1's tests) passes; the function-form config does not break test discovery.

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "feat: drive vite dev/preview ports from env (default 3000/3001)"
```

---

## Task 3: Env-driven port in playwright.config.ts

**Files:**
- Modify: `playwright.config.ts` (full file shown below)

- [ ] **Step 1: Replace the config with the env-driven version**

Replace the entire file. It resolves the preview port from `PREVIEW_PORT` (process env first, then `.env.local`, then default 3001) and derives `baseURL`/`webServer.url` from it:

```ts
import { defineConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';

function resolvePreviewPort(): number {
  if (process.env['PREVIEW_PORT']) {
    return Number(process.env['PREVIEW_PORT']);
  }
  try {
    const contents = readFileSync('.env.local', 'utf8');
    const match = contents.match(/^PREVIEW_PORT=(\d+)/m);
    if (match) {
      return Number(match[1]);
    }
  } catch {
    // No .env.local (e.g. the main checkout) — fall through to the default.
  }
  return 3001;
}

const previewPort = resolvePreviewPort();
const baseURL = `http://localhost:${previewPort}/PokeMMO-Breeding-Calculator/`;

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    timeout: 60000,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add playwright.config.ts
git commit -m "feat: drive playwright port from PREVIEW_PORT/.env.local (default 3001)"
```

---

## Task 4: Verify the main checkout on 3000/3001 (full gate)

**Files:** none (verification only).

- [ ] **Step 1: Confirm no `.env.local` exists in this checkout**

Run: `ls -a | grep -c '^.env.local$' || true`
Expected: prints `0` (main checkout has no `.env.local`, so defaults 3000/3001 apply).
Note: do not `cat` `.env*` files — `.claude/settings.json` denies it.

- [ ] **Step 2: Confirm the dev server binds to 3000**

Run: `npm run dev &` then, after ~3s, `curl -sI http://localhost:3000/PokeMMO-Breeding-Calculator/ | head -1`; then kill the dev server (`kill %1`).
Expected: an HTTP `200`/`304` status line from port 3000 (Vite started on 3000, not 5173).

- [ ] **Step 3: Run the e2e suite (proves PREVIEW_PORT plumbing on 3001)**

Run: `npm run test:e2e`
Expected: PASS — Playwright starts `npm run preview` on 3001 and all specs pass against `http://localhost:3001/PokeMMO-Breeding-Calculator/`.

- [ ] **Step 4: Run the remaining gate**

Run: `npm run test:unit && npm run typecheck && npm run lint`
Expected: all PASS.

- [ ] **Step 5: No code change to commit** — this task is a gate. If anything fails, fix in the relevant task above before proceeding.

---

## Task 5: Worktree setup script (install + write .env.local)

**Files:**
- Create: `scripts/setup-worktree.mjs`

- [ ] **Step 1: Write the script**

Create `scripts/setup-worktree.mjs`:

```js
// Worktree setup, run by the SessionStart hook (and safe to run manually).
// Reads the hook event JSON from stdin, and for a worktree session:
//   1. runs `npm install` if node_modules is missing, then
//   2. writes a per-worktree .env.local with a distinct port pair.
// Bare-node only (no deps): this runs BEFORE node_modules exists.
import { execSync } from 'node:child_process';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { portsForWorktree } from './worktree-port.mjs';

let payload = {};
try {
  const raw = readFileSync(0, 'utf8'); // fd 0 = stdin
  if (raw.trim()) payload = JSON.parse(raw);
} catch {
  // No/invalid stdin (manual run) — fall back to process.cwd().
}

const targetDir = payload.cwd || process.cwd();

// Only act inside a worktree; no-op for the main checkout.
if (!targetDir.includes('/.claude/worktrees/')) {
  process.exit(0);
}

if (!existsSync(join(targetDir, 'node_modules'))) {
  execSync('npm install', { cwd: targetDir, stdio: 'inherit' });
}

const { devPort, previewPort } = portsForWorktree(basename(targetDir));
writeFileSync(
  join(targetDir, '.env.local'),
  `DEV_PORT=${devPort}\nPREVIEW_PORT=${previewPort}\n`,
);
console.log(`[setup-worktree] ${basename(targetDir)} -> dev:${devPort}, preview:${previewPort}`);
```

- [ ] **Step 2: Verify `.env.local` is already git-ignored (no gitignore change)**

Run: `git check-ignore .env.local; echo "exit=$?"`
Expected: prints `.env.local` and `exit=0` — already covered by the `*.local` pattern. If it is NOT ignored (exit=1), add a line `.env.local` to `.gitignore` and commit it.

- [ ] **Step 3: Smoke-test the script against the current worktree**

This worktree's path contains `/.claude/worktrees/`, so the script will treat it as a worktree. `node_modules` already exists here, so `npm install` is skipped; it should only write `.env.local`.

Run: `node scripts/setup-worktree.mjs < /dev/null`
Expected: prints `[setup-worktree] <worktree-name> -> dev:<even port>, preview:<odd port>` with ports in 3002–3181.

- [ ] **Step 4: Verify the written file (without `cat`)**

Run: `grep -E '^(DEV_PORT|PREVIEW_PORT)=[0-9]+$' .env.local`
Expected: two lines, `DEV_PORT=<even>` and `PREVIEW_PORT=<even+1>`, matching the Step 3 output.
Note: use `grep`, not `cat`/Read — `.env.*` reads are denied for agent tools.

- [ ] **Step 5: Remove the smoke-test artifact**

Run: `rm -f .env.local`
Expected: removed (it is git-ignored, so this does not affect the working tree status). This keeps the in-progress worktree on its hash-derived port only when intended.

- [ ] **Step 6: Commit**

```bash
git add scripts/setup-worktree.mjs
git commit -m "feat: worktree setup script — npm install + distinct .env.local port"
```

---

## Task 6: Wire the SessionStart hook + verify firing

**Files:**
- Modify: `.claude/settings.json`

- [ ] **Step 1: Add the `hooks` block (keep existing `permissions`)**

The current `.claude/settings.json` contains only a `permissions` key. Add a sibling `hooks` key so the file becomes:

```json
{
  "permissions": {
    "deny": [
      "Read(.env)",
      "Read(.env.*)",
      "Read(**/.env)",
      "Read(**/.env.*)",
      "Edit(.env)",
      "Edit(.env.*)",
      "Edit(**/.env)",
      "Edit(**/.env.*)",
      "Write(.env)",
      "Write(.env.*)",
      "Write(**/.env)",
      "Write(**/.env.*)",
      "Bash(cat *.env*)",
      "Bash(cat */.env*)"
    ]
  },
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
    ]
  }
}
```

Note: `timeout` is in **seconds** (300 = 5 min, generous headroom for `npm install`). The script self-guards (no-op outside `/.claude/worktrees/`, skips install when `node_modules` exists), so firing on every session start is cheap on the main checkout.

- [ ] **Step 2: Empirically verify SessionStart fires with a `cwd` payload**

The reliable trigger is a *fresh* `claude` session whose cwd is a worktree. Verify the hook is registered and inspect its input shape:

Run: `claude --print --debug hooks "say hi" 2>&1 | grep -i -A2 SessionStart | head -20`
Expected: debug output shows the `SessionStart` matcher executing `node ".../scripts/setup-worktree.mjs"`. (If `--debug hooks` output differs by version, instead confirm registration with: the hook appears when you run `claude` and check `/hooks` — record what you observe.)

If you cannot confirm via the CLI in this environment, record that the wiring is in place and defer live verification to Task 7's end-to-end worktree check, which exercises the script directly regardless of hook firing.

- [ ] **Step 3: Commit**

```bash
git add .claude/settings.json
git commit -m "feat: SessionStart hook installs deps + assigns worktree port"
```

**Conditional follow-up (only if Task 7 shows worktrees need eager setup at creation, before any new session):** add a `WorktreeCreate` hook. Its stdout is contractually the new worktree path, so the script must, when `payload.hook_event_name === 'WorktreeCreate'`, route all log/`npm install` output to stderr and print only `targetDir` to stdout, and derive `targetDir` from `payload.name` (`join(projectRoot, '.claude/worktrees', payload.name)`) when `payload.cwd` is absent. Do not add this speculatively — only if the Task 7 observation proves SessionStart-only leaves a real gap.

---

## Task 7: End-to-end worktree verification

**Files:** none (verification only). This proves a second worktree gets a distinct port and does not collide with the main checkout.

- [ ] **Step 1: Create a throwaway worktree directly with git**

Run:
```bash
git worktree add .claude/worktrees/port-verify-throwaway HEAD
```
Expected: a new worktree directory is created. (Using raw `git worktree add` lets us test the setup script deterministically without depending on hook firing.)

- [ ] **Step 2: Run the setup script against it**

Run: `node scripts/setup-worktree.mjs < /dev/null` from inside that directory, i.e.:
```bash
( cd .claude/worktrees/port-verify-throwaway && node scripts/setup-worktree.mjs < /dev/null )
```
Expected: it runs `npm install` (node_modules is missing in the fresh worktree), then prints `[setup-worktree] port-verify-throwaway -> dev:<port>, preview:<port>`.

- [ ] **Step 3: Confirm the worktree got a distinct, in-range port pair**

Run: `grep -E '^(DEV_PORT|PREVIEW_PORT)=' .claude/worktrees/port-verify-throwaway/.env.local`
Expected: `DEV_PORT`/`PREVIEW_PORT` in 3002–3181, an even/odd pair, and **not** 3000/3001.

- [ ] **Step 4: Confirm determinism**

Run the Step 2 command again.
Expected: identical port pair (npm install now skipped; `.env.local` rewritten with the same values).

- [ ] **Step 5: Tear down the throwaway worktree**

Run:
```bash
git worktree remove --force .claude/worktrees/port-verify-throwaway
```
Expected: directory removed; `git worktree list` no longer shows it.

- [ ] **Step 6: No commit** — verification only.

---

## Task 8: Final gate

**Files:** none.

- [ ] **Step 1: Run the full suite on the main checkout**

Run: `npm run test:unit && npm run test:e2e && npm run typecheck && npm run lint`
Expected: all PASS (unit incl. port tests, e2e on 3001, clean typecheck/lint).

- [ ] **Step 2: Confirm a clean working tree**

Run: `git status --short`
Expected: empty (all changes committed; no stray `.env.local`).

---

## Self-review notes

- **Spec coverage:** dev→3000 (Task 2/4), preview+e2e→3001 (Task 2/3/4), worktree `npm install` (Task 5/7), distinct per-worktree ports (Task 1/5/7), stateless allocation (Task 1), env-driven config with defaults (Task 2/3), no central registry (Task 1), gitignore handled (Task 5 verifies `*.local` covers it), cleanup is no-op (stateless — covered by Task 7 teardown).
- **Hook uncertainty** is isolated to Task 6/7 and does not block the core (configs + script work whether or not a hook fires).
- **Type consistency:** `portsForWorktree(name) -> { devPort, previewPort }` used identically in Tasks 1, 5, 7; `DEV_PORT`/`PREVIEW_PORT` env keys consistent across `.env.local`, `vite.config.ts`, `playwright.config.ts`, and the script.
