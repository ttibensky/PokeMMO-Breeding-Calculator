# Bundled static Pokémon dataset derived from PokeAPI

* Status: accepted
* Deciders: Tomas Tibensky, Claude (orchestrator)
* Date: 2026-06-13

## Context and Problem Statement

The app needs species data — names, sprites, egg groups, gender ratios, abilities (including hidden) — for the species PokeMMO supports. This data powers autocomplete search and breeding logic. It must work offline and, critically, must make unit and e2e tests deterministic with no live network dependency. Source of truth for the data is PokeAPI (https://pokeapi.co/).

## Decision Drivers

* Tests must be deterministic and network-free; live API calls in tests are a hard no.
* App must function offline (GitHub Pages, no backend).
* Avoid runtime rate-limit risk from PokeAPI.
* PokeMMO supports only a subset of mainline species and has known deviations from PokeAPI data.

## Considered Options

* (a) Call PokeAPI live at runtime
* (b) Build-time generation script snapshots PokeAPI into a curated static JSON bundled with the app
* (c) Live calls in production, mocked in tests

## Decision Outcome

Chosen option: "(b) Build-time generation script", because it is the only approach that satisfies all drivers simultaneously: tests are deterministic, the app works offline, and there is no runtime rate-limit exposure.

A build-time script pulls the required fields from PokeAPI for the PokeMMO-supported species set and emits a curated static JSON file (or files) bundled with the app. Sprites are referenced by stable PokeAPI CDN URL or bundled locally. Re-running the script refreshes the dataset.

Note: PokeMMO's supported species list and any per-species deviations from PokeAPI (e.g. move availability, form differences) require a dedicated curation pass before the dataset can be considered authoritative.

### Positive Consequences

* Tests are fully deterministic — no network, no flake.
* App loads species data instantly from the bundle; no fetch latency.
* Works offline without any service-worker complexity.
* PokeAPI rate limits are a build-time concern only, not a user-facing one.

### Negative Consequences

* Dataset can go stale; regeneration must be triggered manually when PokeMMO updates or PokeAPI data changes.
* Requires maintaining a build script and understanding the PokeAPI schema.
* PokeMMO-specific subset and known deviations from mainline must be manually curated and encoded.

## Pros and Cons of the Options

### (a) Live PokeAPI calls at runtime

* Good, because data is always current with no regeneration step.
* Bad, because tests become non-deterministic and require real network access.
* Bad, because the app does not work offline.
* Bad, because PokeAPI rate limits affect end users directly.

### (b) Build-time snapshot bundled with the app

* Good, because tests are deterministic and run without network.
* Good, because load performance is optimal — data is local.
* Good, because no runtime dependency on PokeAPI availability.
* Bad, because data freshness requires a manual regeneration step.
* Bad, because the build script must be maintained alongside schema changes.

### (c) Live calls in production, mocked in tests

* Good, because production data stays current.
* Bad, because test mocks diverge from real data over time, hiding integration bugs.
* Bad, because the production app still has rate-limit exposure and no offline capability.
* Bad, because maintaining accurate mocks is ongoing work that provides false assurance.

## Links

* Enabled by [ADR-0002](0002-github-pages-hosting.md) (static hosting — no server to proxy API calls)
* Consumed by ADR-0009 (breeding engine) and the species autocomplete search UI
