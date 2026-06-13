# Mantine UI library with violet primary, light theme

* Status: accepted
* Deciders: Tomas Tibensky, Claude (orchestrator)
* Date: 2026-06-13

## Context and Problem Statement

The app requires a polished, accessible UI with specific components: autocomplete/combobox for Pokémon search, forms, notifications, and modals. Building these from scratch is disproportionate effort. The app must use violet as its primary color and a light (non-dark) color scheme. A UI component library is needed; the choice of which one is open.

## Decision Drivers

* Accessibility out of the box — components must meet WCAG standards without manual ARIA work.
* Batteries included — autocomplete, combobox, notifications, modals, and form inputs are all needed.
* First-class theming — `primaryColor` and forced `colorScheme` must be trivially configurable.
* Development speed — an AI-driven build benefits from comprehensive, well-documented components.
* Explicit user requirement: Mantine was selected by the user.

## Considered Options

* Mantine
* shadcn/ui + Tailwind (Radix primitives, copy-in component model)
* MUI (Material Design)

## Decision Outcome

Chosen option: "Mantine", configured with `primaryColor: 'violet'` and `forceColorScheme: 'light'` in the `MantineProvider` theme. Use Mantine's built-in `Autocomplete`/`Combobox`, `Notifications`, `Modal`, and form components throughout.

### Positive Consequences

* Consistent, accessible UI with minimal custom component code.
* Theming is a single config object — violet primary and forced light scheme require two lines.
* Comprehensive component set covers every UI need in this app without reaching for additional libraries.
* Less bespoke component logic means less surface area to test.

### Negative Consequences

* Mantine's visual language and design opinions are opinionated — customizing beyond its theming system requires overrides.
* Upgrading between major Mantine versions (e.g., v6 → v7) can be a significant migration.
* Slight bundle size overhead compared to a headless/copy-in approach.

## Pros and Cons of the Options

### Mantine

* Good, because every component needed (Combobox, Notifications, Modal, forms) ships in the library.
* Good, because `primaryColor` and `colorScheme` theming are first-class, documented features.
* Good, because accessible by default — keyboard navigation, ARIA roles, focus management handled.
* Good, because explicit user requirement.
* Bad, because locked into Mantine's visual style; deep customization requires CSS overrides.
* Bad, because larger bundle than a headless alternative.

### shadcn/ui + Tailwind

* Good, because components are copied into the repo — no library version lock-in.
* Good, because Tailwind makes per-component styling straightforward.
* Bad, because each component copied in becomes code the project must own and maintain.
* Bad, because more components to build/own means more to test; slower initial velocity.
* Bad, because user explicitly preferred Mantine over this model.

### MUI (Material Design)

* Good, because mature, comprehensive component library with strong accessibility.
* Good, because extensive theming system including primary color overrides.
* Bad, because Material Design aesthetic is distinct and not desired for this app.
* Bad, because heavier bundle and more complex theming API than Mantine.
* Bad, because user explicitly did not select MUI.
