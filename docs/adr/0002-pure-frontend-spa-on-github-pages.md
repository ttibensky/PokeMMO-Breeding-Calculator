# Pure client-side SPA hosted on GitHub Pages, no backend

* Status: accepted
* Deciders: Tomas Tibensky, Claude (orchestrator)
* Date: 2026-06-13

## Context and Problem Statement

The PokeMMO Breeding Calculator manages a user's personal Pokémon inventory and breeding projects. The user requirement is explicit: pure frontend application, no backend, hosted on GitHub Pages. The question is which architecture best satisfies that constraint while remaining practical to build and maintain.

## Decision Drivers

* Zero hosting cost — GitHub Pages is free.
* Operational simplicity — no server to provision, secure, or monitor.
* Data privacy — user inventory and projects stay on their device; nothing is sent to a server.
* Offline capability — a static app can function without a network connection after first load.
* Explicit user requirement: no backend.

## Considered Options

* Pure SPA + browser localStorage, static hosting (GitHub Pages)
* SPA + serverless/BaaS backend (e.g., Firebase, Supabase) for cross-device sync
* Traditional full backend (server, database, authentication)

## Decision Outcome

Chosen option: "Pure SPA + browser localStorage, static hosting", because it directly satisfies the explicit user requirement, eliminates all operational complexity, and keeps all user data local to the device.

All application state (inventory, breeding projects, settings) is persisted in `localStorage`. The app is deployed as a static file bundle to GitHub Pages via CI.

### Positive Consequences

* Free to host with no infrastructure to manage.
* User data never leaves the device — strong privacy guarantee.
* Works offline after the initial page load.
* No authentication, sessions, or API keys to manage.

### Negative Consequences

* No cross-device sync — data is siloed per browser profile.
* No server-side backup — data is lost if the user clears browser storage. Mitigated later by an export/import feature.
* No server-side validation or business-logic enforcement.

## Pros and Cons of the Options

### Pure SPA + localStorage, GitHub Pages

* Good, because zero cost and zero operational burden.
* Good, because strongest privacy — no data leaves the device.
* Good, because works offline.
* Bad, because no sync across devices or browsers.
* Bad, because localStorage is not a durable store — users can lose data.

### SPA + serverless/BaaS backend

* Good, because enables cross-device sync and cloud backup.
* Good, because still relatively low operational cost.
* Bad, because violates the explicit no-backend user requirement.
* Bad, because introduces auth, API keys, and vendor lock-in.
* Bad, because adds cost and attack surface even if small.

### Traditional full backend

* Good, because maximum flexibility — full server-side logic, relational data model.
* Bad, because violates the user requirement, and the complexity is wildly disproportionate to a breeding calculator.
* Bad, because hosting cost, server maintenance, and security obligations.

## Links

* Enables [ADR-0003](0003-react-typescript-vite.md) (Vite produces a pure static build)
