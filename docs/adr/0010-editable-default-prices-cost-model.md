# Editable default prices for cost estimation

* Status: accepted
* Deciders: Tomas Tibensky, Claude (orchestrator)
* Date: 2026-06-13

## Context and Problem Statement

Breeding cost is driven by consumables and fees whose GTL market prices fluctuate: Power items (~$10k each, consumed per breed; two per competitive breed), Everstone (one per nature-carrying line), gender-selection fees ($5k for a 1:1 species up to $25k for the minority gender of a 7:1 species), and the Ability Pill ($35k). The calculator must estimate total cost without a live price feed — none exists. How should prices be sourced?

## Decision Drivers

* The calculator should produce useful estimates out of the box, with no required setup.
* Prices drift over time; users must be able to correct them.
* No external API or network dependency is acceptable for a static SPA.

## Considered Options

* (a) Hardcode all prices in source code.
* (b) Require the user to enter every price before any estimate is shown.
* (c) Ship sensible editable defaults, persisted and overridable in a Settings panel.

## Decision Outcome

Chosen option: "(c) Editable defaults in Settings, persisted to localStorage", because it works immediately for new users while remaining accurate for users who track current prices.

The cost model reads all prices from a settings store (defaulting to bundled constants). Changes are persisted to localStorage so they survive page reloads. The Settings panel surfaces every configurable value with its unit and a brief label.

**Open questions flagged for in-game verification** — sources conflict on two Everstone mechanics:

1. *Consumed vs reusable*: when a parent holding an Everstone is destroyed in a breed, is the Everstone lost? Default assumption: **consumed per breed** (the holder is destroyed).
2. *Nature pass rate*: is nature transfer "always" or "50%"? Default assumption: **guaranteed with a single Everstone**.

These are modeled as named constants in the settings store, clearly flagged as unverified, so they can be corrected without a code change.

### Positive Consequences

* Works immediately with no user setup.
* Fully customizable per user; no network dependency.
* Uncertain mechanics are explicit constants, not buried assumptions.

### Negative Consequences

* Bundled defaults drift from live market prices; users must remember to update them.
* A user who never updates prices may act on stale cost figures.

## Pros and Cons of the Options

### (a) Hardcode prices in source code

* Good, because zero configuration needed.
* Bad, because updating prices requires a code change and redeployment.
* Bad, because different users may face different prices (e.g. different servers or time periods).

### (b) Require user to enter all prices before any estimate

* Good, because all figures are explicitly user-validated.
* Bad, because first-time users see no estimate until they complete a lengthy form — high friction.
* Bad, because casual users will abandon the flow.

### (c) Editable defaults persisted to localStorage (chosen)

* Good, because estimates appear immediately for new users.
* Good, because power users can tune every value without touching code.
* Good, because uncertain mechanics (Everstone behavior) are surfaced as named, editable constants.
* Bad, because defaults age; the README or in-app notice should remind users to verify prices periodically.

## Links

* Feeds cost estimates into [ADR-0009](0009-adaptive-replanning-breeding-engine.md).
