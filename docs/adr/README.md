# Architecture Decision Records

This directory records the **significant** decisions made while building the PokeMMO Breeding Calculator — architectural, technical, and product decisions that are costly to reverse or that future contributors (human or AI) would otherwise have to reverse-engineer.

We use the [**MADR**](https://adr.github.io/madr/) (Markdown Any Decision Records) format. The canonical template lives in [`template.md`](./template.md) in this directory.

## When to write an ADR

Write an ADR whenever a decision is **significant** — i.e. it meets any of:

* It shapes the architecture, tech stack, data model, or a cross-cutting convention.
* It is expensive or disruptive to reverse later.
* It rules out alternatives a reasonable contributor would otherwise consider.
* It encodes a non-obvious tradeoff, constraint, or PokeMMO-specific mechanic that drives the design.

Do **not** write an ADR for trivial, easily-reversible, or purely-local choices (variable names, one-off helpers, formatting).

> **Automatic capture:** Significant decisions made during development should be recorded here as they happen, not retrofitted later. When a decision in this category is made (in a planning discussion, a PR, or an agent task), add the corresponding ADR in the same change.

## How to create a new ADR

1. **Copy the template:** `cp template.md NNNN-short-title.md`
   * `NNNN` is the next zero-padded sequence number (e.g. `0013`).
   * `short-title` is a kebab-case summary (e.g. `0013-use-web-workers-for-planning`).
2. **Fill it in** following the template sections. Keep the title a short noun phrase describing *the decision* (the solution), not the problem.
3. **Set the metadata:** `Status`, `Deciders`, and `Date` (`YYYY-MM-DD`).
4. **Record real alternatives** under *Considered Options* — an ADR with only one option isn't a decision record.
5. **Link related ADRs** in the *Links* section (e.g. `Refined by`, `Supersedes`, `Relates to`).
6. **Add a row** to the [Index](#index) below.

## Status lifecycle

`proposed` → `accepted` → (later) `deprecated` or `superseded by [ADR-XXXX]`. A rejected proposal is kept with status `rejected` (we record what we chose *not* to do and why). Never delete an ADR — supersede it. To reverse a decision, write a **new** ADR that supersedes the old one and update the old one's status with a back-link.

## Numbering & filenames

* Format: `NNNN-kebab-case-title.md`, zero-padded to 4 digits, starting at `0001`.
* Numbers are immutable once assigned and never reused.

## Index

| ADR | Title | Status |
|----:|-------|--------|
| [0001](./0001-record-architecture-decisions.md) | Record architecture decisions using MADR | accepted |
| [0002](./0002-pure-frontend-spa-on-github-pages.md) | Pure client-side SPA hosted on GitHub Pages, no backend | accepted |
| [0003](./0003-react-typescript-vite.md) | React + TypeScript built with Vite | accepted |
| [0004](./0004-mantine-ui-violet-light-theme.md) | Mantine UI library with violet primary, light theme | accepted |
| [0005](./0005-hash-based-routing.md) | Hash-based routing for GitHub Pages | accepted |
| [0006](./0006-zustand-localstorage-state.md) | Zustand + localStorage for state and persistence | accepted |
| [0007](./0007-bundled-static-pokemon-dataset.md) | Bundled static Pokémon dataset derived from PokeAPI | accepted |
| [0008](./0008-global-pool-multiple-projects-data-model.md) | Global owned-Pokémon pool with multiple breeding projects | accepted |
| [0009](./0009-adaptive-replanning-breeding-engine.md) | Adaptive re-planning breeding engine (best-next-pair) | accepted |
| [0010](./0010-editable-default-prices-cost-model.md) | Editable default prices for cost estimation | accepted |
| [0011](./0011-comprehensive-scope-optional-advanced-features.md) | Comprehensive scope with optional advanced features | accepted |
| [0012](./0012-testing-strategy-vitest-playwright.md) | Testing strategy: Vitest unit + Playwright e2e | accepted |
