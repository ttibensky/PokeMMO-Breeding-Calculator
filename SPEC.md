# PokeMMO Breeding Calculator — Build Specification

This is the authoritative specification for building the app. It is the input to the `/goal` command. Read it top to bottom, then build in the milestone order in §12, committing after each milestone, until all acceptance criteria (§13) pass.

**Companion documents (read these too):**
- `docs/breeding-mechanics.md` — PokeMMO-specific breeding rules the engine must implement (cited, with confidence flags and 6 open questions to encode as configurable constants).
- `docs/adr/` — 12 Architecture Decision Records (MADR). The decisions below are summarized here but the ADRs hold the rationale and alternatives. **When you make a new significant decision during the build, add an ADR** (see `docs/adr/README.md`).
- `CLAUDE.md` and `.claude/rules/delegation-protocol.md` — how to work (orchestrator + subagent fleet, mandatory testing).

## 1. Product summary

A pure-frontend web app that helps a PokeMMO player plan and execute IV/nature/ability breeding. The user records the Pokémon they own, sets a target Pokémon (perfect IVs + nature + ability + gender, with optional advanced constraints), and the app produces an adaptive, step-by-step breeding plan with held items, genders, candidate parents, and a cost estimate. As the user breeds in-game and reports each result, the app re-plans and tracks cost-vs-estimate. Multiple independent breeding projects run concurrently over one shared owned-Pokémon pool.

## 2. Hard constraints (from the user)

- **Pure frontend**, no backend; all data in browser **localStorage**. Hosted on **GitHub Pages** (repo is currently private; will be made public on release).
- **React + TypeScript + Vite**.
- **Mantine** UI, **violet** primary color, **light** theme (never dark).
- Species data, images, egg groups, gender ratios, abilities from **PokeAPI** (https://pokeapi.co/), consumed as a **build-time static snapshot** (not live calls) so tests are deterministic.
- **Full e2e coverage** of every user journey (Playwright) **and complete unit tests** for every component/hook/helper (Vitest). Tests are the development & verification mechanism — no manual browser navigation/screenshots.
- The user runs the app locally (`npm run dev`) and breeds in the actual game alongside it.
- UI/UX must follow strong industry practices (accessibility, responsive, clear empty/loading/error states).

## 3. Architecture (see ADRs 0002–0012)

- **SPA**, React Router **HashRouter** (GitHub Pages friendly).
- State: **Zustand** with `persist` middleware → localStorage, organized as slices: `ownedPokemon`, `projects`, `settings`. Include a versioned `migrate` for schema evolution.
- **Static dataset**: a generation script (`scripts/build-dataset.ts`, run via an npm script, NOT at app runtime) fetches from PokeAPI for the PokeMMO-supported species set and writes `src/data/pokemon.generated.json` (+ a typed loader). Sprites referenced by stable PokeAPI sprite URL. Committed to the repo so builds/tests need no network.
- **Breeding engine** is pure, framework-free TypeScript in `src/engine/` — fully unit-tested in isolation.
- Vite `base` set to the repo name for correct GitHub Pages asset paths.

## 4. Suggested project structure

```
/                      Vite + TS app root
  index.html
  vite.config.ts       (base, test config)
  src/
    main.tsx, App.tsx, router.tsx, theme.ts   (Mantine violet/light theme)
    data/              pokemon.generated.json + typed loader + types
    engine/            breeding engine (pure TS) + cost model + *.test.ts
    store/             zustand slices (owned, projects, settings) + *.test.ts
    features/
      owned/           OwnedPokemon list/form/search components
      projects/        project list + project detail + plan view + report-result flow
      settings/        prices + feature toggles
    components/        shared UI (PokemonAvatar, IVInput, StatBadge, …)
    hooks/             reusable hooks + *.test.ts
  scripts/build-dataset.ts
  e2e/                 Playwright specs + fixtures
  docs/                breeding-mechanics.md, adr/, (this spec referenced)
  .github/workflows/   ci.yml (test/lint/typecheck), deploy.yml (Pages)
```

## 5. Domain data model (TypeScript)

Encode these as the persisted schema (refine names as needed; keep them stable once chosen):

```ts
type StatKey = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
type IVs = Record<StatKey, number>;            // 0..31
type Gender = 'male' | 'female' | 'genderless';

interface OwnedPokemon {
  id: string;                 // uuid
  speciesId: number;          // dex id into the static dataset
  ivs: IVs;
  nature: string;
  ability: string;
  isHiddenAbility: boolean;
  gender: Gender;
  isShiny: boolean;
  isAlpha: boolean;
  eggMoves: string[];
  notes?: string;
  createdAt: string;          // ISO
  // allocation/consumption tracked via project progress, not duplicated here
}

interface BreedingGoal {
  speciesId: number;
  targetIVs: Partial<Record<StatKey, 31>>;  // 2..6 perfect stats selected
  nature?: string;                          // optional
  ability?: string;                         // optional
  requireHiddenAbility?: boolean;
  gender?: Gender;                          // optional target
  requireShiny?: boolean;                   // advanced (shiny×shiny only)
  eggMoves?: string[];                      // advanced
}

interface BreedStepResult {            // a completed breed the user reported
  id: string;
  parentAId: string; parentBId: string;
  heldItems: { a?: ItemKey; b?: ItemKey };
  forcedGender?: Gender;
  resultPokemonId: string;             // the new OwnedPokemon created
  costSpent: number;                   // actual, from settings prices at the time
  reportedAt: string;
}

interface BreedingProject {
  id: string;
  name: string;
  goal: BreedingGoal;
  status: 'planning' | 'in-progress' | 'done' | 'abandoned';
  progress: BreedStepResult[];
  createdAt: string;
}

interface Settings {
  prices: Record<ItemKey | 'genderFeeBase' | 'genderFeeMax' | 'abilityPill', number>;
  features: {                          // progressive disclosure — niche default OFF
    eggMoves: boolean;
    hiddenAbility: boolean;
    shiny: boolean;
    alpha: boolean;
  };
  // configurable mechanic constants (the 6 open questions from breeding-mechanics.md §"Open questions")
  mechanics: {
    everstoneConsumed: boolean;        // default true
    everstoneGuaranteed: boolean;      // default true
    // probability splits etc. as constants with documented defaults
  };
}
```

`ItemKey` covers the six Power items + Everstone.

## 6. Breeding engine (`src/engine/`) — ADR 0009

Pure, deterministic-where-possible, fully unit-tested. Core responsibilities:

1. **Validation** — given a candidate pair, return validity + reasons: same egg group, opposite gender (or Ditto), genderless⇒Ditto, shiny↔non-shiny invalid, HA-propagation feasibility, etc. (See `docs/breeding-mechanics.md` §1, §4, §7–9.)
2. **Inheritance model** — given two parents + held items, compute the distribution of possible offspring (which IVs are guaranteed vs probabilistic per §2; nature via Everstone §3; ability/HA §4; gender §5; shiny/alpha/egg-move propagation §7–9).
3. **Planner (best-next-pair)** — given the current owned pool + a goal, compute:
   - the recommended next pairing (the two parents, the Power item on each, required/forced gender, and the list of alternative candidate parents from the pool),
   - a projected remaining plan (ordered remaining breeds) and **projected total cost + breeds remaining** using the pyramid math (§6) and the cost model (§7),
   - identified **gaps**: base 1×31 (or attribute-carrier) Pokémon the user still needs to acquire.
4. **Re-plan** — when the user reports an actual result (a new `OwnedPokemon`), recompute from the updated pool. Support **manual parent override** (user picks the two parents; engine still validates, assigns items, and estimates).
5. **Estimate** — standalone "what will this goal cost / how many breeds" without committing, from an empty or partial pool.

Communicate uncertainty: projections are estimates, not guarantees (the inheritance is probabilistic).

## 7. Cost model (`src/engine/cost.ts`) — ADR 0010, mechanics §11

Sum, reading amounts from `Settings.prices`: Power items (consumed, up to 2/breed), Everstone (per nature line; consumed-by-default constant), gender-selection fee ($5k–$25k scaled by ratio), Ability Pill (one-off), Ditto cost for genderless lines. Provide both the up-front **estimate** for a goal and the **running actual** as steps are reported, plus estimate-vs-actual delta on the project. Default prices ship sensible and are editable in Settings.

## 8. Screens / UX (Mantine, violet, light)

1. **Owned Pokémon** — searchable list (Mantine autocomplete/Spotlight against the static dataset, with sprites), add/edit form (species, 6 IV inputs, nature, ability + HA flag gated by feature toggle, gender, shiny/alpha/egg-moves gated by toggles, notes). Empty state guides first add.
2. **Projects list** — cards per breeding project with goal summary, status, progress %, estimate-vs-spent. Create-project entry point.
3. **Project detail** — the goal; the **current recommendation** (next pair + items + genders + candidate alternates); the **projected plan & cost**; identified **gaps to acquire**; a **progress timeline** of reported breeds with running cost; and a **"report result"** flow (pick/confirm the two parents → enter the baby's stats → engine creates the child in the owned pool, marks parents consumed, advances the plan).
4. **Settings** — editable prices/fees, feature toggles (egg moves / HA / shiny / alpha), and the configurable mechanic constants (with help text and the "[verify in-game]" caveats from the mechanics doc).
5. **App shell** — nav, responsive layout, clear loading/empty/error states, accessible (keyboard, labels, focus, contrast). Optional data **export/import** (JSON) is a nice-to-have given there's no backend.

**Progressive disclosure:** advanced fields/columns appear only when their feature toggle is on; the default experience is IVs + nature + ability + gender.

## 9. Testing (ADR 0012, delegation rules) — mandatory

- **Unit (Vitest, co-located `*.test.ts(x)`):** every engine function (inheritance, validation, planner, cost, pyramid math — including the table values in mechanics §6), every store slice/action + migration, every hook, every non-trivial component. Cover edge cases: genderless/Ditto, low-female-ratio fees, shiny pairing rules, HA propagation, egg-move chaining, 2×31…6×31 and "+nature" trees.
- **E2E (Playwright, `/e2e/`):** full journeys — first-run/empty states; add owned Pokémon via search; create a goal; view recommendation & estimate; report a result and see the plan/cost advance; run multiple concurrent projects over the shared pool; abandon/finish a project and start a new tree; edit prices/toggles and see effects. Deterministic via the bundled dataset (no live network).
- **Gate:** a task is done only when `test:unit` + `test:e2e` + `tsc -b` + `eslint .` are all green.

## 10. Tooling & scripts

`package.json` scripts (names the workflow/CI expect): `dev`, `build`, `preview`, `test:unit`, `test:e2e`, `lint`, `typecheck`, `build:dataset`. ESLint + Prettier configured. TypeScript strict.

## 11. Deployment (GitHub Pages)

- Vite `base: '/<repo-name>/'`.
- `.github/workflows/ci.yml`: install, typecheck, lint, unit, e2e on PR/push.
- `.github/workflows/deploy.yml`: build and deploy to GitHub Pages (Pages artifact + deploy action) on push to `main`. HashRouter so deep links/refresh work.
- Document local run + deploy in `README.md`.

## 12. Milestone build order (commit after each)

1. **Scaffold** — Vite+TS+React, Mantine (violet/light theme), HashRouter, ESLint/Prettier/strict TS, Vitest + Playwright wired, app shell + nav, CI workflow. *Verify: dev runs, empty app renders, both test runners execute a smoke test green.*
2. **Static dataset** — `scripts/build-dataset.ts` + generated JSON + typed loader, PokeMMO-supported species, sprites. *Verify: loader unit tests; dataset committed.*
3. **State layer** — Zustand slices (owned/projects/settings) + persist + migration. *Verify: store unit tests.*
4. **Owned Pokémon feature** — search/list/add/edit, progressive-disclosure fields. *Verify: unit + e2e for the owned-mon journey.*
5. **Breeding engine** — validation, inheritance, cost, pyramid, planner, re-plan. *Verify: extensive unit tests incl. mechanics tables & edge cases.*
6. **Projects feature** — list, create goal, project detail with recommendation/estimate/gaps/timeline, report-result flow, multiple concurrent projects. *Verify: unit + full e2e journeys.*
7. **Settings** — editable prices/fees, feature toggles, mechanic constants. *Verify: unit + e2e (changing a price/toggle changes outputs).*
8. **Polish & deploy** — a11y/responsive pass, empty/loading/error states, export/import (optional), README, deploy workflow. *Verify: full suite green; build succeeds with correct base path.*

## 13. Acceptance criteria (definition of done for the app)

- `npm run dev` runs the app locally; `npm run build` produces a GitHub-Pages-deployable build with correct base path.
- A user can: add owned Pokémon via search; create one or more breeding goals (2–6 perfect IVs + optional nature/ability/gender and optional advanced constraints); see a next-step recommendation with held items/genders/candidates; see a projected cost & breed count; report breed results and watch the plan re-plan and cost track against estimate; run several projects at once over a shared pool; finish/abandon a project and start a new tree.
- Advanced mechanics (egg moves, HA, shiny, Alpha) are correctly modeled and **optional** behind toggles; the default UI stays simple.
- Costs use editable default prices; the 6 uncertain mechanics are configurable constants with sensible defaults.
- `test:unit`, `test:e2e`, `typecheck`, `lint` all green in CI. Every component/hook/helper has unit tests; every user journey has an e2e test.
- New significant decisions made during the build are captured as ADRs.

## 14. Known open questions (defaults already chosen — see mechanics doc)

The six items in `docs/breeding-mechanics.md` → "Open questions to confirm in-game" are implemented as configurable constants with the defaults noted there (Everstone consumed + guaranteed nature; documented probability splits; ~80% ability pass; gender-fee endpoints; regional-form behavior flagged). They do not block the build.
