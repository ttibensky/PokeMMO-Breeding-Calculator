# README live-app callout — Design

## Goal

The README does not tell readers that the app is already hosted and usable
without cloning. Add a callout, immediately under the description, that links to
the live deployment and states no clone/install is required.

## Change

Single documentation edit to `README.md`. Insert a live-app callout after the
description paragraph (current line 3) and before the `---` divider (current
line 5).

### Content to insert

```markdown
[![Live App](https://img.shields.io/badge/Live_App-Open-brightgreen)](https://ttibensky.github.io/PokeMMO-Breeding-Calculator/)

Use it right away in your browser — no clone or install required.
```

### Resulting top of README

```markdown
# PokeMMO Breeding Calculator

A pure-frontend breeding planner for [PokeMMO](https://pokemmo.com/). ... The calculator runs locally alongside the game in your browser.

[![Live App](https://img.shields.io/badge/Live_App-Open-brightgreen)](https://ttibensky.github.io/PokeMMO-Breeding-Calculator/)

Use it right away in your browser — no clone or install required.

---

## Tech Stack
```

## Decisions

- **Style: Shields.io badge.** Chosen over a plain bold line or a bold
  blockquote for prominence — the badge is clickable and visually signals "live
  / open". This introduces badge styling the README does not currently use,
  accepted deliberately.
- **Placement:** directly under the description, above the `---`, per the
  request that the info live at the top right under the description.
- **Live URL:** `https://ttibensky.github.io/PokeMMO-Breeding-Calculator/`.

## Scope and non-goals

- No code changes, no behavior changes.
- No changes to other README sections (Tech Stack, Features, Getting Started,
  Scripts).

## Testing

None. The diff is pure documentation with nothing assertable; per the project
testing policy, docs-only diffs are exempt. Verification is a visual check that
the badge and link render correctly.
