# Deploy-gated tests + local deploy trigger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop running tests on pushes to `main` while keeping them on branches/PRs and as the deploy gate, and add a local `npm run deploy` command.

**Architecture:** Edit the `ci.yml` `push` trigger to ignore `main` (tests still run on other branch pushes, PRs, and via `workflow_call` from `deploy.yml`). Add a `deploy` npm script that invokes the existing manual `deploy.yml` workflow via the `gh` CLI.

**Tech Stack:** GitHub Actions (YAML workflows), npm scripts, `gh` CLI.

**Testing note:** This is a CI-config + npm-script change with no application behavior to assert — it falls under the testing-policy exemption (no unit/e2e tests apply). TDD steps are replaced with explicit verification steps.

---

### Task 1: Exclude `main` from the CI push trigger

**Files:**
- Modify: `.github/workflows/ci.yml` (the `on:` block at the top)

- [ ] **Step 1: Read the current trigger block**

Run: `sed -n '1,12p' .github/workflows/ci.yml`
Expected: an `on:` block containing `push:`, `pull_request:`, and `workflow_call:`. Confirm the exact current shape before editing (the `push:` key currently has no `branches`/`branches-ignore` filter).

- [ ] **Step 2: Edit the `push` trigger to ignore `main`**

Change the `push:` entry under `on:` so it reads:

```yaml
on:
  push:
    branches-ignore:
      - main
  pull_request:
  workflow_call:
```

Preserve any other keys already present in the `on:` block (e.g. `workflow_dispatch`) and the existing indentation style. Only the `push:` entry changes; do not touch `pull_request:` or `workflow_call:`.

- [ ] **Step 3: Verify the YAML is valid**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('valid')"`
Expected: `valid`

- [ ] **Step 4: Verify the trigger semantics**

Run: `python3 -c "import yaml; d=yaml.safe_load(open('.github/workflows/ci.yml')); on=d[True] if True in d else d['on']; print(on['push']); assert on['push']['branches-ignore']==['main']; assert 'pull_request' in on; assert 'workflow_call' in on; print('OK')"`
Expected: prints the push config then `OK`. (Note: PyYAML parses the bare key `on` as the boolean `True`, hence the `d[True]` fallback.)

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: stop running tests on push to main"
```

---

### Task 2: Add the local `deploy` npm script

**Files:**
- Modify: `package.json` (the `"scripts"` object)

- [ ] **Step 1: Inspect the current scripts block**

Run: `npm pkg get scripts`
Expected: a JSON object of existing scripts (includes `test:unit`, `test:e2e`, `typecheck`, `lint`, `build`). Confirm there is no existing `deploy` key.

- [ ] **Step 2: Add the `deploy` script**

Run: `npm pkg set scripts.deploy="gh workflow run deploy.yml"`

This adds `"deploy": "gh workflow run deploy.yml"` to the `scripts` object without disturbing formatting of other keys.

- [ ] **Step 3: Verify the script was added**

Run: `npm pkg get scripts.deploy`
Expected: `"gh workflow run deploy.yml"`

- [ ] **Step 4: Verify the workflow reference resolves**

Run: `gh workflow view deploy.yml --json name,state -q '.name + " / " + .state'`
Expected: prints the deploy workflow name and `active` (confirms `gh` is authenticated and `deploy.yml` resolves). Do NOT run `gh workflow run` — that would trigger a real deploy.

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "chore: add local deploy script (npm run deploy)"
```

---

## Self-Review

- **Spec coverage:** Both spec requirements are covered — Task 1 (stop tests on push to `main`, keep on branches/PRs/deploy gate) and Task 2 (local `npm run deploy`). No gaps.
- **Placeholder scan:** No TBD/TODO/"handle edge cases" placeholders; every step has exact commands or YAML.
- **Type consistency:** N/A (no shared types/signatures across tasks).
