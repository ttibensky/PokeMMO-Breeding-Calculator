# Global owned-Pokémon pool with multiple breeding projects

* Status: accepted
* Deciders: Tomas Tibensky, Claude (orchestrator)
* Date: 2026-06-13

## Context and Problem Statement

Users register the Pokémon they actually own (IVs, nature, ability, gender, held item, etc.) once and then run several breeding efforts concurrently — e.g. three target species at once, or restarting a tree after selling a finished mon. Owned Pokémon are a shared inventory across all efforts. How should the data model represent this to avoid duplication and correctly reflect allocation and consumption?

## Decision Drivers

* Match the user's mental model: owned Pokémon are a single inventory, not per-project copies.
* Avoid duplicating inventory data across projects.
* Support many concurrent, independent breeding trees.
* Track which owned mons are allocated or consumed so the same mon cannot be double-spent.

## Considered Options

* (a) One global `ownedPokemon` collection referenced by many project entities
* (b) Each project owns an isolated copy of its relevant Pokémon

## Decision Outcome

Chosen option: "(a) Global `ownedPokemon` collection + separate `breedingProjects` collection", because it matches the user's actual mental model, eliminates duplication, and makes allocation/consumption visible across the whole app.

Concretely:
- `ownedPokemon`: a keyed collection of Pokémon records (IVs, nature, ability, gender, species, etc.), each with a stable `id`.
- `breedingProjects`: a collection of project records, each holding the breeding goal, a progress log of completed breeds, running cost summary, and references to owned Pokémon by `id`.
- Allocation state (reserved/consumed) lives on the `ownedPokemon` record and is updated transactionally when a breed step completes (parents are consumed in PokeMMO).

### Positive Consequences

* Single source of truth for inventory — editing a mon's record is reflected everywhere immediately.
* No duplication; the owned pool stays lean regardless of how many projects reference it.
* Allocation conflicts (same mon eyed by two projects) are detectable at the data layer.

### Negative Consequences

* Referential integrity must be enforced in application logic — deleting a mon that is referenced by an active project requires explicit handling.
* The "parents consumed on breed" lifecycle (PokeMMO mechanic) must be implemented carefully: marking a mon as consumed must cascade to all projects that reference it.
* Allocation conflicts between concurrent projects require a defined resolution policy.

## Pros and Cons of the Options

### (a) Global pool + project references

* Good, because a single inventory edit is reflected in all projects immediately.
* Good, because no data duplication regardless of project count.
* Good, because allocation/consumption state is globally consistent.
* Bad, because referential integrity (delete, consume) is application-layer responsibility.
* Bad, because allocation conflict resolution needs an explicit policy.

### (b) Per-project isolated copies

* Good, because each project is fully self-contained — no cross-project coupling.
* Bad, because the same physical mon must be entered multiple times if used across projects.
* Bad, because edits to a mon's record (e.g. correcting an IV) must be replicated manually to every project copy.
* Bad, because there is no way to detect that the same mon is being allocated to two projects simultaneously.

## Links

* Realized via [ADR-0006](0006-zustand-localstorage-state.md) (Zustand stores for owned pool and projects)
* Consumed by ADR-0009 (breeding engine logic)
