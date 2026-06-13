# Hash-based routing for GitHub Pages

* Status: accepted
* Deciders: Tomas Tibensky, Claude (orchestrator)
* Date: 2026-06-13

## Context and Problem Statement

The app is a multi-screen SPA (owned Pokémon, breeding projects, project detail, settings) deployed to GitHub Pages. GitHub Pages serves static files only — there is no server-side rewrite rule. Refreshing or sharing a deep path (e.g. `/projects/42`) returns a 404 because the file does not exist on disk. How do we support deep links and refresh without server control?

## Decision Drivers

* Deep links and page refresh must work correctly on GitHub Pages.
* Avoid fragile workarounds that break silently on GitHub Pages config changes.
* SEO is irrelevant — this is a stateful local tool, not indexed content.

## Considered Options

* (a) React Router with `HashRouter`
* (b) React Router with `BrowserRouter` + a 404.html redirect hack
* (c) In-memory router (no URL state at all)

## Decision Outcome

Chosen option: "(a) React Router with `HashRouter`", because it is the only option that works natively on GitHub Pages without server config and without fragile workarounds.

### Positive Consequences

* Deep links and refresh work with zero server configuration.
* No 404.html redirect hack to maintain or explain.
* Standard React Router API — no special routing code.

### Negative Consequences

* `#` appears in all URLs (cosmetic issue only).
* History-based browser features (e.g. canonical URLs, `rel=canonical`) are lost — acceptable given SEO is a non-goal.

## Pros and Cons of the Options

### (a) React Router with `HashRouter`

* Good, because routing is entirely client-side; GitHub Pages never sees the path fragment.
* Good, because deep links and refresh work with no server changes.
* Good, because it is a first-class React Router API with full feature parity otherwise.
* Bad, because URLs contain `#`, which looks less clean.

### (b) BrowserRouter + 404.html redirect hack

Technique: GitHub Pages serves `404.html` for unknown paths; a script there encodes the path into the query string and redirects to `/`, where the app reconstructs the route.

* Good, because URLs look clean (no `#`).
* Bad, because the hack depends on undocumented GitHub Pages behavior that could change.
* Bad, because it adds custom redirect logic that is hard to debug and easy to break on repo rename/custom-domain changes.

### (c) In-memory router (no URL state)

* Good, because completely sidesteps the GitHub Pages problem.
* Bad, because users cannot bookmark or share links to specific screens.
* Bad, because browser back/forward navigation does not work as expected.

## Links

* Follows [ADR-0002](0002-github-pages-hosting.md) (GitHub Pages hosting decision)
