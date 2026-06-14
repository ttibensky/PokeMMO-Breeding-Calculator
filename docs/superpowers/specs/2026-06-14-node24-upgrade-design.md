# Node.js 24 Upgrade: CI Actions + Local Dev

**Date:** 2026-06-14
**Status:** Approved

## Background

GitHub Actions emits a deprecation warning: `actions/checkout@v4` and `actions/setup-node@v4` bundle a Node.js 20 runtime to execute their own action code. Node 20 will be forced to Node 24 starting June 16th, 2026 and removed from runners September 16th, 2026. This is about the **action runtime**, independent of the Node version the project builds and tests with.

The repo currently:
- Runs both workflows' actions on Node 20 (via `@v4`/`@v3`/`@v5` action majors).
- Builds/tests on Node `22` (`setup-node`'s `node-version: '22'`).
- Pins **no** local dev Node version (no `.nvmrc`, no `engines.node`).

This work clears the deprecation across both workflows, moves the build/test runtime to Node 24, and pins local dev to match.

## Scope

### 1. Bump all GitHub Actions to their Node 24 majors

`.github/workflows/ci.yml`:

| Action | Current | New |
|---|---|---|
| `actions/checkout` | `@v4` | `@v6` |
| `actions/setup-node` | `@v4` | `@v6` |

`.github/workflows/deploy.yml`:

| Action | Current | New |
|---|---|---|
| `actions/checkout` | `@v4` | `@v6` |
| `actions/setup-node` | `@v4` | `@v6` |
| `actions/configure-pages` | `@v5` | `@v6` |
| `actions/upload-pages-artifact` | `@v3` | `@v5` |
| `actions/deploy-pages` | `@v4` | `@v5` |

Notes: `checkout`/`setup-node` v6 is the current major (v5 also runs Node 24; we go to v6). `setup-node@v6` still supports explicit `cache: 'npm'`, so that line is unchanged. All five target majors have a Node 24 release, so both workflows go warning-free.

### 2. Bump build/test Node 22 -> 24

- Change `node-version: '22'` -> `'24'` in both `ci.yml` and `deploy.yml`.
- Bump `@types/node` `^22.15.29` -> `^24` in `package.json` so type-checking matches the runtime.
- Node 24 is current LTS; Vite 6, Vitest 3, Playwright 1.52, and TypeScript 5.8 all support it.

### 3. Pin local dev Node

- Add `.nvmrc` containing `24`, so `nvm use` / `fnm` selects the right major.
- Add `engines.node: ">=24"` to `package.json` (documents the floor and warns on older Node; not a hard block — no `engine-strict`).

### 4. README prerequisites

- Update the Getting Started prerequisite line from `Node.js 22` to `Node.js 24`, and reference `.nvmrc` / `nvm use` as the one-liner to match.
- Leave the existing Playwright `npx playwright install chromium` instruction unchanged — it is already correct.

Confirmed complete local-dev prerequisites (no change needed beyond the above): Node.js 24 (via nvm/fnm), npm (bundled with Node), and Playwright Chromium (`npx playwright install chromium`, one-time, e2e only). No `.env`, system packages, submodules, or postinstall steps exist.

## Testing & Verification

This is a config/CI change with no application behavior to assert, so it falls under the project's "nothing to assert" test exemption — no new Vitest/Playwright specs are added.

Verification is the existing full suite passing on **Node 24**, run after switching the worktree to Node 24:

1. `tsc -b` (typecheck — most likely to surface a `@types/node` bump issue)
2. `eslint .`
3. `vitest run`
4. `npx playwright install chromium` then `playwright test` (e2e)
5. `vite build`

Real-world confirmation: the next CI run goes green with zero Node 20 deprecation warnings.

## Out of Scope

- Changing application code, dependencies other than `@types/node`, or test behavior.
- Adopting `setup-node@v6`'s automatic caching via a `packageManager` field (keeping explicit `cache: 'npm'`).
- Any unrelated workflow or README edits.
