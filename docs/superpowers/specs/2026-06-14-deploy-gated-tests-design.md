# Deploy-gated tests + local deploy trigger

**Date:** 2026-06-14
**Status:** Approved

## Problem

Tests currently run on every push to `main`, which is redundant: the code was
already tested on its feature branch before merging, and the full suite runs
again as the deploy gate. We want to stop tests on pushes to `main`, while still
running them during branch/PR development and as the gate on every deploy. We
also want to initiate the deploy from the local terminal with a single command
rather than clicking the GitHub Actions web button.

## Current state

- **`.github/workflows/ci.yml`** — triggers on `push` (any branch),
  `pull_request`, and `workflow_call`. Runs typecheck → lint → unit tests →
  build → e2e.
- **`.github/workflows/deploy.yml`** — `workflow_dispatch` only. Calls `ci.yml`
  via `workflow_call` (tests gate the deploy), then build, then deploy to GitHub
  Pages.

## Design

### 1. Stop tests on push to `main`

In `ci.yml`, change the `push` trigger to ignore `main`:

```yaml
on:
  push:
    branches-ignore:
      - main
  pull_request:
  workflow_call:
```

Resulting behavior:

| Event | CI runs? |
|---|---|
| Push to a feature branch | Yes |
| Pull request | Yes |
| Push to `main` | No |
| Deploy (`workflow_call`) | Yes — full suite remains the deploy gate |

Jobs and steps are unchanged — only the trigger is edited.

### 2. Local deploy command

Add to `package.json` scripts:

```json
"deploy": "gh workflow run deploy.yml"
```

Running `npm run deploy` triggers the existing GitHub-hosted `deploy.yml`, which
runs `ci.yml` (full test suite), then build, then deploy to Pages. Requires an
authenticated `gh` CLI (already in use in this project).

## Net effect

Tests no longer run on pushes to `main`, but still run on branches/PRs during
development and as the gate on every deploy. Deploy is initiated with one local
command.

## Testing

This is a CI-config + npm-script change with no application behavior to assert,
so it falls under the testing-policy exemption (no unit/e2e tests apply).
Verification: confirm the `ci.yml` YAML is valid and that `gh workflow run
deploy.yml` resolves the deploy workflow.
