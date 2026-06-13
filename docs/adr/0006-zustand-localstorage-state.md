# Zustand + localStorage for state and persistence

* Status: accepted
* Deciders: Tomas Tibensky, Claude (orchestrator)
* Date: 2026-06-13

## Context and Problem Statement

With no backend, all state — the global owned-Pokémon pool, multiple breeding projects with progress, and settings — must live in the browser and survive page reloads. The state layer must also be easy to unit-test in isolation, without mounting React trees. How do we manage and persist this state with minimal complexity?

## Decision Drivers

* Minimal boilerplate; the state surface is modest and should not require ceremony.
* Store logic must be unit-testable without React (plain JS/TS calls).
* Persistence must support versioning and migration as the schema evolves.
* No backend — everything lives client-side.

## Considered Options

* (a) Zustand + `persist` middleware
* (b) Redux Toolkit + redux-persist
* (c) React Context + `useReducer` + manual `localStorage`
* (d) Jotai

## Decision Outcome

Chosen option: "(a) Zustand + `persist` middleware", because it offers the smallest API surface, stores are plain functions testable without React, and the `persist` middleware handles serialization and schema migration out of the box.

State is organized as slices: `ownedPokemon`, `breedingProjects`, and `settings`. Each slice exposes a versioned `migrate` function to handle schema evolution as the app grows.

### Positive Consequences

* Tiny API — actions are plain function calls; no action creators or reducers required.
* Store logic is testable as plain TypeScript without a React render environment.
* `persist` middleware handles `localStorage` read/write and exposes a `version`/`migrate` hook for schema evolution.

### Negative Consequences

* Less prescriptive structure than Redux — slice boundaries and naming conventions require team discipline to stay consistent.
* Schema migration is manual; the `migrate` function must be updated deliberately on every breaking change to the persisted shape.

## Pros and Cons of the Options

### (a) Zustand + `persist` middleware

* Good, because the API is minimal — a store is just a function with `set`/`get`.
* Good, because stores are callable outside React; straightforward to unit-test.
* Good, because `persist` ships versioned migration; no custom serialization glue.
* Bad, because it imposes no structural conventions — discipline required.

### (b) Redux Toolkit + redux-persist

* Good, because highly prescriptive — slices, reducers, and selectors follow a well-known pattern.
* Good, because large ecosystem, wide familiarity.
* Bad, because significant boilerplate (actions, reducers, selectors, store config) for a tool of this scale.
* Bad, because redux-persist configuration (transforms, whitelist, migration) adds meaningful complexity.

### (c) React Context + `useReducer` + manual `localStorage`

* Good, because zero external dependencies.
* Bad, because every persistent field requires manual serialization/deserialization logic.
* Bad, because Context re-renders all consumers on any state change — performance degrades as state grows.
* Bad, because testing requires wrapping components in providers.

### (d) Jotai

* Good, because atomic model composes well and avoids unnecessary re-renders.
* Bad, because persistence and migration require additional libraries or custom glue.
* Bad, because the atomic model is a less natural fit for the nested, relational shape of this data (pool + projects + references).

## Links

* Realizes the data model described in [ADR-0008](0008-global-pool-multiple-projects-data-model.md)
