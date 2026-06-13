# GitHub Pages Deploy — Design

**Date:** 2026-06-13
**Status:** Approved (pending spec review)

## Goal

Make GitHub Pages deploys for the PokeMMO Breeding Calculator work reliably,
triggered **manually via the `gh` CLI**, and **gated on full CI passing** so a
broken build can never ship.

Live URL after first successful deploy:
`https://ttibensky.github.io/PokeMMO-Breeding-Calculator/`

## Background — why it fails today

The application code and build config are already correct for Pages:

- `vite.config.ts` sets `base: '/PokeMMO-Breeding-Calculator/'` (correct for a
  project-level Pages site).
- Routing uses `HashRouter` (`src/router.tsx`), so no server-side 404 rewrite
  or SPA fallback is needed.
- `.github/workflows/deploy.yml` already builds and uploads `dist/` and deploys
  via `actions/deploy-pages@v4`.

The deploys fail for one reason only: **GitHub Pages was never enabled** with
the "GitHub Actions" source. The `gh api .../pages` endpoint returns 404, and
the last three `deploy.yml` runs all failed in ~30s at the Pages-configuration
step. Nothing in the app needs changing.

## Decisions (locked)

| Question | Decision |
|---|---|
| How do deploys trigger? | **Manual only** — `workflow_dispatch`, driven by `gh workflow run`. No push-to-main auto-deploy, no tag triggers. |
| Gate on tests? | **Full CI** — lint + unit + e2e + typecheck must pass before build & deploy. |
| How is Pages enabled? | **Self-enabling from the workflow** via `actions/configure-pages` `enablement: true`. |
| Documentation? | **Add a Deployment section to `README.md`** documenting the `gh` workflow. |

## Changes

### 1. `.github/workflows/ci.yml` — make it reusable

Add `workflow_call` to its `on:` triggers (additive — existing push/PR triggers
stay). This lets `deploy.yml` reuse the *exact same* checks as a single source
of truth, instead of duplicating step lists.

```yaml
on:
  push:
    branches: [main]
  pull_request:
  workflow_call:
```

### 2. `.github/workflows/deploy.yml` — manual-only + CI-gated

- **Triggers:** replace the `on:` block with `workflow_dispatch:` only. Remove
  `push: branches: [main]`.
- **Concurrency:** add a `pages` concurrency group so two manual runs cannot
  clobber each other mid-deploy:

  ```yaml
  concurrency:
    group: pages
    cancel-in-progress: false
  ```

- **Gate on CI:** add a `ci` job that calls the reusable workflow, and chain the
  existing jobs behind it:

  ```yaml
  jobs:
    ci:
      uses: ./.github/workflows/ci.yml

    build:
      needs: ci
      # ... existing build steps ...

    deploy:
      needs: build
      # ... existing deploy steps ...
  ```

- **Self-enable Pages:** in the `build` job's `actions/configure-pages` step,
  add `with: enablement: true`. On the first manual run this turns Pages on
  automatically — no out-of-band settings click.

  Fallback if org policy blocks self-enablement: a one-time
  `gh api -X POST repos/ttibensky/PokeMMO-Breeding-Calculator/pages -f build_type=workflow`.

- **Permissions** stay as-is (`contents: read`, `pages: write`,
  `id-token: write`); the reusable `ci` job only needs the default read access.

No `.nojekyll` file is needed: the Actions artifact deploy serves the upload
directly and bypasses Jekyll processing.

### 3. `README.md` — add a Deployment section

Document the `gh`-driven flow. Content to cover:

- Trigger a deploy: `gh workflow run deploy.yml`
- Watch it: `gh run watch` (or `gh run list --workflow=deploy.yml`)
- What runs: full CI (lint + unit + e2e + typecheck) → build → publish; ships
  only if CI is green.
- First run self-enables Pages.
- Live URL: `https://ttibensky.github.io/PokeMMO-Breeding-Calculator/`

Match the existing README's heading style and tone.

## How to deploy (end state)

```bash
gh workflow run deploy.yml      # kick off a manual deploy
gh run watch                    # follow it to completion
```

The run executes lint + unit + e2e + typecheck, builds the site, and publishes
to Pages only if every check passes.

## Testing & verification

This change is entirely CI/YAML configuration — there are no application units
to unit-test, so per the project testing policy this is the explicit
"nothing to assert" exemption (no `*.test.ts` applies).

**Verification is behavioral and out-of-band:** trigger a real deploy with
`gh workflow run deploy.yml`, confirm the run goes green end-to-end (CI → build
→ deploy), and confirm the live URL loads the running app. A YAML-syntax /
workflow-lint check (e.g. `actionlint` if available, or GitHub's own parse on
push) is the only static gate.

## Out of scope

- Custom domain / CNAME.
- Auto-deploy on push or tags (explicitly rejected — manual only).
- Any change to application code, routing, or the Vite `base` path.
- The existing `docs/` folder (it holds specs, not a Pages source).
