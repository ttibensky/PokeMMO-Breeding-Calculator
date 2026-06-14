# Testing conventions

Conventions for writing and dispatching tests in this repo. The orchestrator must
fold the relevant items into every `test-author` brief.

## Playwright (e2e)

- **Hash routing.** The app uses hash-based routing. Navigation targets are
  `/#/<path>` (e.g. `/#/projects`), **not** `/<path>`. A test that navigates to a
  bare path lands on the wrong view.
- **Scope selectors.** Multiple similar controls exist (e.g. several nature/ability
  dropdowns). Never use an unscoped selector like `[role="option"]` — scope by
  `data-testid` or by the enclosing form/section so the selector is unambiguous.

## Required `test-author` brief checklist

Every `test-author` dispatch for an e2e test must state:

1. The exact navigation path, including the `#` hash.
2. The scoped selector for the element(s) under test.
3. The state transition or assertion the test must verify.

## Diagnostic probes and screenshots

Throwaway diagnostic specs and screenshots (selector discovery, screenshot
inspection) must be named with a leading underscore — `e2e/_probe.spec.ts`,
`e2e/_shot_*.png` — so they are auto-ignored (see `.gitignore`'s `e2e/_*`). Delete
them when the investigation is done. The `verifier` never creates such files
(see `.claude/agents/verifier.md`); legitimate probes belong to a debugging
`explorer`/`implementer` and use the `_` prefix.
