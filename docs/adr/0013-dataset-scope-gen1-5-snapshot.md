# Static dataset scope: National Dex 1–649 (Gen 1–5) snapshot from PokeAPI

* Status: accepted
* Deciders: build team (orchestrator + subagents)
* Date: 2026-06-13

Technical Story: Milestone 2 of SPEC.md — build a build-time static dataset (ADR 0007) for the species the app reasons about.

## Context and Problem Statement

The breeding engine and UI need per-species data (egg groups, gender ratio, abilities incl. hidden ability, sprite, learnable moves). SPEC.md §3 mandates a build-time static snapshot from PokeAPI committed to the repo (no runtime API calls), but leaves the exact "PokeMMO-supported species set" to be chosen. What range of species do we snapshot, and what shape do we store?

## Decision Drivers

* Determinism: tests must run with no network (SPEC.md §2, §9).
* Coverage of the species players actually breed in PokeMMO.
* Bundle/repo size kept reasonable.
* The data dimensions the engine needs (pairing, gender fees, abilities/HA, egg-move legality).

## Considered Options

* **National Dex 1–649 (Gen 1–5)** — PokeMMO's long-standing core region set (Kanto/Johto/Hoenn/Sinnoh/Unova).
* Full National Dex 1–1025 (all generations) — larger, includes many species PokeMMO has not implemented.
* A hand-curated PokeMMO-exact list scraped from the wiki — most precise but brittle and high-maintenance.

## Decision Outcome

Chosen option: **National Dex 1–649 (Gen 1–5)**. It cleanly covers PokeMMO's core supported regions, is unambiguous to generate (contiguous id range), and keeps the snapshot at ~1.5 MB. PokeMMO has incrementally added some later species; the id range is a single constant in `scripts/build-dataset.ts` (`speciesRange`) and can be widened later without code changes.

Per-species shape stored: `id, name (English species name), types, spriteUrl (stable PokeAPI sprites-repo URL pattern), eggGroups, genderRate (+ derived isGenderless, femaleRatio), abilities[{name,isHidden}], moves[] (union of all learn methods)`. Wrapper: `{ generatedAt, source, speciesRange, species[] }`.

### Positive Consequences

* Deterministic, offline tests; dataset committed.
* O(1) lookups via a `speciesById` Map in the typed loader (`src/data/index.ts`).
* `moves[]` captured now (free in the same fetch) so the egg-move feature needs no second generation pass.

### Negative Consequences

* `moves[]` is the union across ALL games, so it includes post-Gen-5 moves; egg-move legality is a superset of true PokeMMO legality. Acceptable for a planning aid; can be filtered later if needed.
* Egg-group/ability names use PokeAPI's canonical slugs (e.g. the Grass egg group is `"plant"`). Consistent internally, so pairing comparisons are correct; only matters for display prettification.
* Later-gen species PokeMMO may have added are excluded until the range is widened.

## Links

* Refines [ADR-0007](0007-bundled-static-pokemon-dataset.md)
* Implements SPEC.md §3, §4 (Suggested project structure: `src/data/`)
