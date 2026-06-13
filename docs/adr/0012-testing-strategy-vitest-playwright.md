# Testing strategy: Vitest unit + Playwright e2e

* Status: accepted
* Deciders: Tomas Tibensky, Claude (orchestrator)
* Date: 2026-06-13

## Context and Problem Statement

The app is developed and verified primarily through automated tests — the AI-driven workflow forbids manual browser navigation or screenshots as the verification mechanism. The user mandates full e2e coverage of user journeys and complete unit tests for every component, hook, and helper. Which test frameworks and conventions should the project standardize on?

## Decision Drivers

* Tests are the development oracle: a code task is only "done" when the suite is green.
* The verifier agent must be able to run the full suite deterministically with no live network or browser state.
* Fast unit feedback during development; full journey coverage before merge.
* Determinism: the bundled static species dataset (ADR-0007) removes the need for network mocking in e2e runs.

## Considered Options

* (a) E2e only (Playwright).
* (b) Unit only (Vitest).
* (c) Both — Vitest for units, Playwright for e2e journeys, verifier gates on the combined result.

## Decision Outcome

Chosen option: "(c) Vitest + Playwright", because neither layer alone gives sufficient confidence: unit tests cannot catch routing or rendering regressions; e2e tests are too slow for rapid development feedback on pure logic.

**Conventions:**

* **Unit tests**: co-located `*.test.ts(x)` files next to their source. Run with `npm run test:unit`. Cover all components, hooks, helpers, and engine logic.
* **E2e tests**: `*.spec.ts` files under `/e2e/`. Run with `npm run test:e2e`. Cover complete user journeys (goal setup → pairing recommendation → result reporting → cost estimate).
* **Done gate**: a task is complete only when all of the following pass — `npm run test:unit`, `npm run test:e2e`, `tsc -b` (typecheck), `eslint .` (lint).
* **No exemptions** without an explicit written reason. Pure config or comment-only diffs are the only valid exemptions.
* **Determinism**: e2e runs use the bundled static dataset; no live network calls, no external API mocking needed.

### Positive Consequences

* Reliable autonomous develop-verify loop: the verifier agent has an unambiguous pass/fail signal.
* Behavior is covered at both unit (fast, isolated) and journey (slow, integrated) levels.
* No flakiness from network dependencies in e2e.

### Negative Consequences

* Test-maintenance overhead: every feature and every advanced-feature toggle (ADR-0011) adds test cases.
* Playwright setup and browser binary management add CI complexity compared to unit-only.
* The broader test matrix from optional features (ADR-0011) must be explicitly accounted for in e2e specs.

## Pros and Cons of the Options

### (a) E2e only

* Good, because high confidence that journeys work end-to-end.
* Bad, because slow feedback loop for pure logic changes.
* Bad, because pinpointing a broken utility function requires running a full browser scenario.

### (b) Unit only

* Good, because fast, easy to run locally and in CI.
* Bad, because routing, rendering, and multi-step user flows are not covered.
* Bad, because the AI workflow would have no way to verify behavioral correctness at the app level.

### (c) Vitest + Playwright (chosen)

* Good, because unit tests provide fast feedback on engine logic and helpers.
* Good, because e2e tests catch integration and rendering failures that unit tests miss.
* Good, because the done gate is unambiguous: green across all four checks.
* Bad, because two frameworks to configure, maintain, and teach to subagents.
* Bad, because test matrix grows with every optional feature (ADR-0011).

## Links

* Aligns with repo delegation and testing rules in `.claude/rules/`.
* E2e determinism relies on bundled species data from ADR-0007.
* Test matrix scope driven by optional advanced features in [ADR-0011](0011-comprehensive-scope-optional-advanced-features.md).
