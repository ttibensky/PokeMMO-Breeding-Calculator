# React + TypeScript built with Vite

* Status: accepted
* Deciders: Tomas Tibensky, Claude (orchestrator)
* Date: 2026-06-13

## Context and Problem Statement

The project needs a modern frontend stack that supports strong typing, fast iteration, and a clean static build suitable for GitHub Pages. React and TypeScript are an explicit user requirement. The build tool is an open choice.

## Decision Drivers

* Type safety — TypeScript is required; the stack must support it natively.
* Large ecosystem — React has the widest component and tooling ecosystem.
* Fast dev loop — HMR and cold-start speed matter for an AI-driven, iterate-quickly workflow.
* Simple static build — output must be plain HTML/CSS/JS deployable to GitHub Pages with no server.
* Unit-test integration — Vitest integrates natively with Vite, removing config friction.

## Considered Options

* Vite
* Create React App (CRA)
* Next.js with static export

## Decision Outcome

Chosen option: "Vite", because it is the current de-facto standard for new React + TypeScript projects, produces a clean static bundle, starts instantly in dev, and integrates natively with Vitest — all with minimal configuration.

### Positive Consequences

* Near-instant dev server start and fast HMR.
* TypeScript support out of the box.
* `vite build` produces a self-contained static bundle ready for GitHub Pages.
* Vitest shares the same config and module graph — no separate Jest/Babel setup.
* Minimal, readable config (`vite.config.ts`).

### Negative Consequences

* Not a batteries-included framework — routing, state, and data fetching are assembled separately. Acceptable: the app is a small SPA and we select those pieces deliberately (see subsequent ADRs).

## Pros and Cons of the Options

### Vite

* Good, because fastest cold start and HMR in class.
* Good, because native ES modules — no Webpack/Babel overhead.
* Good, because Vitest integration is zero-config.
* Good, because actively maintained; CRA is deprecated in its favor.
* Bad, because not a framework — requires explicit choices for routing and state.

### Create React App (CRA)

* Good, because historically the default starting point for React.
* Bad, because officially deprecated and unmaintained since 2023.
* Bad, because slow builds and dev server relative to Vite.
* Bad, because Jest + Babel setup is heavier than Vite + Vitest.

### Next.js with static export

* Good, because full-featured framework with file-based routing, image optimization, and strong ecosystem.
* Good, because `output: 'export'` produces static files compatible with GitHub Pages.
* Bad, because SSR, RSC, and server-routing concepts are irrelevant overhead for a pure client-side app.
* Bad, because static export disables several Next.js features, making it a constrained subset of a framework designed for server rendering.
* Bad, because significantly more complex config and mental model than needed.
