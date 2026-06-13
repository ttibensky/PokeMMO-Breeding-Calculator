# Comprehensive scope with optional advanced features

* Status: accepted
* Deciders: Tomas Tibensky, Claude (orchestrator)
* Date: 2026-06-13

## Context and Problem Statement

The app should comprehensively model PokeMMO breeding mechanics — egg moves, Hidden Ability, shiny rules, Alpha Pokémon, gender-ratio constraints — but most users only care about IVs, nature, ability, and gender. Should advanced features be always present, always absent, or conditionally surfaced?

## Decision Drivers

* Casual users should reach a usable breeding plan without navigating advanced mechanics they don't need.
* Power users require full mechanical coverage — omitting HA propagation or Alpha tracking is a gap they will notice.
* Progressive disclosure keeps the common path clean without removing capability.
* Each advanced mechanic has specific PokeMMO rules that differ from mainline Pokémon games; the engine must model them correctly.

## Considered Options

* (a) Minimal scope only — IVs, nature, ability (non-HA), gender.
* (b) All advanced features always visible in the UI.
* (c) Comprehensive engine modeling with advanced features gated behind UI toggles and progressive disclosure; niche features default off.

## Decision Outcome

Chosen option: "(c) Comprehensive engine with optional UI exposure", because it serves both audiences without compromising either experience.

The engine models all mechanics. The UI exposes advanced features (egg moves, Hidden Ability, Alpha tracking, shiny pairing rules, genderless/Ditto paths) only when the relevant toggle is enabled in Settings or the goal explicitly requires them.

**Key PokeMMO rules the engine must implement correctly:**

* **Egg moves**: pass from either parent (not father-only as in some mainline games).
* **Hidden Ability**: propagates only via the female-role parent; sourced exclusively from Alpha Pokémon (no Ability Patch or Capsule in PokeMMO).
* **Shiny**: shiny × shiny = guaranteed shiny offspring; shiny × non-shiny is an invalid pairing (not merely lower odds). The engine must flag this as an error, not a warning.
* **Alpha**: Alpha status carries to offspring only if both parents are Alpha.
* **Genderless species**: require Ditto as one parent at every step; no exceptions.

### Positive Consequences

* Default UI is clean; casual users are not confronted with HA or Alpha mechanics.
* Power users opt in and get full fidelity.
* Engine correctness is not compromised by UI simplification.

### Negative Consequences

* More conditional logic in the UI; each toggle combination is a distinct test case.
* Larger test matrix — the verifier must exercise both default and advanced paths (see ADR-0012).
* Feature toggles add state that must be persisted and migrated if their semantics change.

## Pros and Cons of the Options

### (a) Minimal scope only

* Good, because simple to implement and test.
* Bad, because HA users and Alpha breeders have no tool support — a significant gap.
* Bad, because egg-move breeding is common enough that omitting it would disappoint many users.

### (b) All features always visible

* Good, because nothing is hidden; no toggle to find.
* Bad, because the default screen overwhelms casual users with HA, Alpha, shiny, and egg-move fields they don't care about.
* Bad, because it conflates "complete" with "comprehensible."

### (c) Comprehensive engine, optional UI (chosen)

* Good, because casual users see a focused, simple interface.
* Good, because the engine is correct for all mechanics regardless of what is toggled on.
* Good, because power users can enable exactly what they need.
* Bad, because toggle combinations multiply the test surface.
* Bad, because progressive disclosure requires deliberate UX design to remain discoverable.

## Links

* Engine implementation realized via [ADR-0009](0009-adaptive-replanning-breeding-engine.md).
* Test matrix implications covered in [ADR-0012](0012-testing-strategy-vitest-playwright.md).
