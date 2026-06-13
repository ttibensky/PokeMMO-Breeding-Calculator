# PokeMMO Breeding Calculator

A pure-frontend breeding planner for [PokeMMO](https://pokemmo.com/). Record the Pokémon you own, define breeding goals (target IVs, nature, ability, egg moves, shiny/alpha), and the app produces an adaptive step-by-step breeding plan with cost estimates. All data is stored in `localStorage`; there is no backend or account required. The calculator runs locally alongside the game in your browser.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript + Vite 6 |
| UI | Mantine 7 (violet/light theme) |
| State | Zustand 5 with `persist` middleware |
| Routing | React Router v6 — `HashRouter` (GitHub Pages compatible) |
| Unit tests | Vitest + Testing Library |
| E2E tests | Playwright (Chromium) |

---

## Features

- **Owned Pokémon pool** — catalogue your available Pokémon with their IVs, nature, ability, and egg moves.
- **Projects / goals** — define multiple concurrent breeding targets; the planner works on all of them independently.
- **Step-by-step plan** — the engine generates an ordered breeding sequence, highlights gaps (Pokémon you still need to acquire), and provides cost estimates in Pokéyen.
- **Re-planning after results** — report the outcome of each breeding step and the plan adapts, discarding branches that are no longer needed.
- **Editable prices & configurable mechanics** — adjust item/service prices and toggle mechanics in Settings to match the current in-game economy.
- **Progressive-disclosure advanced features** — egg moves, hidden ability, shiny, and alpha targets are available but hidden until you need them.

---

## Getting Started

**Prerequisites:** Node.js 22 (use `nvm` or `fnm` if needed).

```bash
npm install
npm run dev
```

Open the localhost URL printed in the terminal. The app runs entirely in the browser, so you can keep it open alongside the game.

---

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Type-check + produce an optimised `dist/` build |
| `npm run preview` | Serve the `dist/` build locally for a production preview |
| `npm run test:unit` | Run unit tests with Vitest |
| `npm run test:e2e` | Run end-to-end tests with Playwright |
| `npm run lint` | ESLint across the whole project |
| `npm run typecheck` | TypeScript type-check without emitting files |
| `npm run build:dataset` | Regenerate `src/data/pokemon.generated.json` from PokeAPI |

> **Note on `build:dataset`:** this script calls PokeAPI at build-time and writes a snapshot that is committed to the repo. Normal builds and tests do **not** require network access or running this script — the committed snapshot is used directly.

---

## Testing

**Unit tests** (Vitest):

```bash
npm run test:unit
```

**End-to-end tests** (Playwright — requires Chromium):

```bash
npx playwright install chromium   # one-time setup
npm run test:e2e
```

---

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

---

## Project Structure

```
.
├── src/
│   ├── data/         # Committed Pokémon dataset (pokemon.generated.json)
│   ├── engine/       # Pure breeding-plan logic (no UI dependencies)
│   ├── store/        # Zustand stores (owned pool, projects, settings)
│   ├── features/     # Route-level page components
│   └── components/   # Shared UI components
├── e2e/              # Playwright end-to-end specs
├── scripts/          # build:dataset script (PokeAPI → JSON)
└── docs/
    ├── breeding-mechanics.md
    └── adr/          # Architecture Decision Records
```

---

## Documentation

- **[SPEC.md](./SPEC.md)** — full product specification and feature requirements.
- **[docs/breeding-mechanics.md](./docs/breeding-mechanics.md)** — detailed explanation of PokeMMO breeding mechanics used by the engine.
- **[docs/adr/](./docs/adr/)** — Architecture Decision Records explaining key design choices.

> **Note on mechanics constants:** PokeMMO breeding mechanics are distinct from mainline games. Some constants (e.g. breed costs, IV inheritance rates) are flagged `[verify in-game]` in `docs/breeding-mechanics.md` and can be adjusted in the app's **Settings** page if the game updates.

---

## Worktree cleanup

Each Claude Code worktree (`.claude/worktrees/<name>`) runs its own node
processes — a Vite dev server, a preview server, `vitest` workers, and the
`esbuild` service — on a port pair derived from the worktree name. These are
terminated automatically when the worktree goes away, and can be cleaned up by
hand.

**Automatic triggers:**

- **Worktree removed** — a `WorktreeRemove` hook (`.claude/settings.json`) runs
  `scripts/cleanup-worktree.mjs` and kills that worktree's processes.
- **Merged / PR created** — the finishing flow runs the cleanup explicitly (see
  `.claude/rules/worktree-cleanup.md`), covering the case where the worktree
  directory is kept on disk after merging.

**Manual triggers:**

```bash
# Clean one worktree by its directory name (or path):
npm run cleanup:worktree -- <worktree-name>

# Sweep every worktree directory git no longer tracks (orphan cleanup):
npm run cleanup:worktree
```

The script only ever touches processes under `.claude/worktrees/` — it refuses
to run against the main checkout, so your primary dev server is never affected.
