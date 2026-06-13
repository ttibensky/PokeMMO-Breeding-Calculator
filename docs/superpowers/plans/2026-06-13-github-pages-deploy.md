# GitHub Pages Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make GitHub Pages deploys work as a manual, `gh`-CLI-driven action that is gated on full CI passing and self-enables Pages on first run.

**Architecture:** Reuse `ci.yml` as a callable workflow (`workflow_call`) so `deploy.yml` runs the *exact same* checks as a `needs:` dependency before building and publishing. The deploy trigger becomes `workflow_dispatch`-only. Pages is enabled from the workflow itself via `actions/configure-pages` `enablement: true`.

**Tech Stack:** GitHub Actions, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`, Vite build (`dist/`).

---

## Important: TDD does not apply to this plan

Every change here is GitHub Actions YAML config or README prose. There is **no
application code and nothing to unit-test** — this is the project testing
policy's explicit "nothing to assert" exemption. We do **not** add `*.test.ts`
or e2e specs. Instead each task validates by:

1. Confirming the edited YAML still parses (syntax gate), and
2. (final task) confirming the existing test suite is untouched/green and a real
   manual deploy succeeds.

This is stated up front so workers don't invent meaningless tests.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `.github/workflows/ci.yml` | Modify | Add `workflow_call` trigger so it can be reused by deploy. No step changes. |
| `.github/workflows/deploy.yml` | Modify | Manual-only trigger; gate on the reusable `ci` workflow; self-enable Pages. |
| `README.md` | Modify | Rewrite the existing `## Deployment` section to document the manual `gh` flow. |

---

## Task 1: Make `ci.yml` reusable

**Files:**
- Modify: `.github/workflows/ci.yml:3-5` (the `on:` block)

**Context — current `on:` block:**

```yaml
on:
  push:
  pull_request:
```

- [ ] **Step 1: Add the `workflow_call` trigger**

Replace the `on:` block so the file's lines 3–5 become:

```yaml
on:
  push:
  pull_request:
  workflow_call:
```

This is purely additive — existing push/PR runs are unchanged; we just allow
other workflows to call this one. Do not touch any job/step below it.

- [ ] **Step 2: Validate the YAML parses**

Run:

```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('ci.yml OK')"
```

Expected output: `ci.yml OK` (no traceback).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: allow ci.yml to be reused via workflow_call"
```

---

## Task 2: Make `deploy.yml` manual-only and CI-gated

**Files:**
- Modify: `.github/workflows/deploy.yml` (the `on:` block, the `jobs:` section, and the Configure Pages step)

**Context — relevant current content:**

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
```

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      ...
      - name: Configure Pages
        uses: actions/configure-pages@v5
      ...
```

(The `permissions:` and `concurrency:` blocks already exist and are correct —
**do not change them**.)

- [ ] **Step 1: Replace the whole file with the final version**

Write `.github/workflows/deploy.yml` with exactly this content:

```yaml
name: Deploy to GitHub Pages

on:
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  ci:
    uses: ./.github/workflows/ci.yml

  build:
    needs: ci
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Configure Pages
        uses: actions/configure-pages@v5
        with:
          enablement: true

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

Key differences from the old file: `on:` is now `workflow_dispatch:` only
(no push trigger); a new `ci` job calls the reusable workflow; `build` now
`needs: ci`; and the Configure Pages step gains `with: enablement: true`.

- [ ] **Step 2: Validate the YAML parses**

Run:

```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml')); print('deploy.yml OK')"
```

Expected output: `deploy.yml OK` (no traceback).

- [ ] **Step 3: Lint the workflow if actionlint is available (optional gate)**

Run:

```bash
command -v actionlint >/dev/null && actionlint .github/workflows/deploy.yml .github/workflows/ci.yml || echo "actionlint not installed — skipping (GitHub validates on push)"
```

Expected: either no actionlint output (clean) or the "skipping" message. Any
reported error must be fixed before committing.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: make Pages deploy manual-only, CI-gated, and self-enabling"
```

---

## Task 3: Rewrite the README Deployment section

**Files:**
- Modify: `README.md` (the existing `## Deployment` section, currently around lines 73–81)

**Context — the current section to replace, verbatim:**

```markdown
## Deployment

The app deploys automatically to **GitHub Pages** on every push to `main` via `.github/workflows/deploy.yml`.

A few details worth knowing:

- The Vite config sets `base: '/PokeMMO-Breeding-Calculator/'` to match the repository name, so all asset paths are prefixed correctly.
- `HashRouter` is used instead of `BrowserRouter`, which means deep links and browser refreshes work on GitHub Pages without needing a custom 404 fallback page.
- To enable Pages for the first time: go to **Settings → Pages** in the repository and set **Source** to **GitHub Actions**.
```

- [ ] **Step 1: Replace that section with the new content**

Replace the entire block above (from the `## Deployment` heading through the
last bullet) with exactly this:

````markdown
## Deployment

The app deploys to **GitHub Pages** manually, gated on a full CI run, via `.github/workflows/deploy.yml`. Deploys are never automatic — you trigger them deliberately with the GitHub CLI:

```bash
gh workflow run deploy.yml   # start a manual deploy
gh run watch                 # follow it to completion
```

The workflow runs the full CI suite (lint + unit + e2e + typecheck) and only builds and publishes `dist/` if every check passes. The first run enables GitHub Pages automatically (via `actions/configure-pages` with `enablement: true`), so no manual repository-settings change is required.

Once deployed, the app is live at <https://ttibensky.github.io/PokeMMO-Breeding-Calculator/>.

A few details worth knowing:

- The Vite config sets `base: '/PokeMMO-Breeding-Calculator/'` to match the repository name, so all asset paths are prefixed correctly.
- `HashRouter` is used instead of `BrowserRouter`, which means deep links and browser refreshes work on GitHub Pages without needing a custom 404 fallback page.
````

(The outer ```` ```` ```` fences above are only to show the nested code block —
the file content is the markdown between them, including the inner ```` ``` ````
bash block.)

- [ ] **Step 2: Sanity-check the edit**

Run:

```bash
grep -n "gh workflow run deploy.yml" README.md && grep -c "deploys automatically" README.md
```

Expected: the first grep prints the line with `gh workflow run deploy.yml`; the
second prints `0` (the old "deploys automatically" wording is gone).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document manual gh-driven Pages deploy in README"
```

---

## Task 4: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Confirm no application code or tests were touched**

Run:

```bash
git diff --name-only main...HEAD
```

Expected: only `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`,
`README.md`, and the `docs/superpowers/` design + plan files. No files under
`src/`, `e2e/`, or `package.json`. (If anything else appears, stop and
investigate.)

- [ ] **Step 2: Confirm both workflows parse together**

Run:

```bash
python3 -c "import yaml; [yaml.safe_load(open(f)) for f in ['.github/workflows/ci.yml','.github/workflows/deploy.yml']]; print('both OK')"
```

Expected output: `both OK`.

- [ ] **Step 3: (Post-merge, manual) Real deploy verification**

This step is **out-of-band and run by the human after merge to `main`**, because
`gh workflow run` resolves workflows from the default branch and the first run
self-enables Pages:

```bash
gh workflow run deploy.yml
gh run watch
```

Then confirm <https://ttibensky.github.io/PokeMMO-Breeding-Calculator/> loads
the running app. Success criteria: the run goes green through `ci → build →
deploy`, and the live URL serves the app.

---

## Self-Review

- **Spec coverage:** Manual-only trigger → Task 2 Step 1 (`on: workflow_dispatch`).
  Full-CI gate → Task 1 (reusable) + Task 2 (`ci` job + `needs: ci`).
  Self-enable Pages → Task 2 (`enablement: true`). README deployment docs →
  Task 3. `gh`-CLI emphasis → Task 3 content. Concurrency group → already present,
  noted as no-change. ✅ All spec requirements mapped.
- **Placeholders:** none — every edit shows exact final content.
- **Type/identifier consistency:** job names (`ci`, `build`, `deploy`) and the
  `needs:` references are consistent across Task 1 and Task 2; reusable path
  `./.github/workflows/ci.yml` matches the file edited in Task 1.
