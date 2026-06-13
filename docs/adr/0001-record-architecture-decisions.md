# Record architecture decisions using MADR

* Status: accepted
* Deciders: Tomas Tibensky, Claude (orchestrator)
* Date: 2026-06-13

## Context and Problem Statement

This is a greenfield project developed largely by AI agents. Significant architectural and product decisions are made frequently, often in chat sessions that leave no durable record. Future contributors — human or AI — need to understand not just what was decided but why, and what alternatives were considered, without re-litigating settled questions.

## Decision Drivers

* Traceability: decisions must be discoverable alongside the code that implements them.
* Onboarding: new contributors (and AI agents starting a fresh session) need decision context in-repo.
* Avoid re-deciding: settled tradeoffs should not resurface with each new session or contributor.
* Low ceremony: the format must be lightweight enough that it actually gets used.

## Considered Options

* No formal records (rely on git history and chat logs)
* MADR in `docs/adr/`
* Michael Nygard lightweight ADRs
* Decisions in a wiki or external tool

## Decision Outcome

Chosen option: "MADR in `docs/adr/`", because it is lightweight, markdown-native, stores decisions alongside code in version control, and explicitly captures alternatives — which is the highest-value part of any decision record.

A `template.md` is committed alongside the ADRs. The project README documents the process. One file per decision, numbered sequentially.

### Positive Consequences

* Decisions are searchable and versioned in the same repo as the code.
* Consistent format makes scanning and onboarding fast.
* Explicit alternatives section prevents "why didn't we just use X?" from resurfacing.

### Negative Consequences

* Requires discipline: decisions must actually be recorded as they are made.
* Some per-decision overhead — acceptable given the project scale and AI-driven workflow.

## Pros and Cons of the Options

### No formal records

* Good, because zero overhead — just ship.
* Bad, because git commit messages rarely capture tradeoffs or rejected alternatives.
* Bad, because AI agents start each session without context; they will re-explore and re-decide.

### MADR in `docs/adr/`

* Good, because markdown, version-controlled, no external tools required.
* Good, because the format explicitly demands considered options, which is the most valuable field.
* Good, because AI agents can be instructed to read `docs/adr/` before proposing changes.
* Bad, because it only works if contributors commit to writing ADRs — process, not tooling, is the risk.

### Michael Nygard lightweight ADRs

* Good, because even simpler format; widely recognized.
* Bad, because does not require listing considered options — the weakest version of a decision record.

### Decisions in a wiki or external tool

* Good, because richer formatting, comment threads, ownership metadata.
* Bad, because decoupled from code — falls out of sync, hard to reference at a specific commit.
* Bad, because adds an external dependency with no offline or AI-agent access.

## Links

* Followed by [ADR-0002](0002-pure-frontend-spa-on-github-pages.md), [ADR-0003](0003-react-typescript-vite.md), [ADR-0004](0004-mantine-ui-violet-light-theme.md)
