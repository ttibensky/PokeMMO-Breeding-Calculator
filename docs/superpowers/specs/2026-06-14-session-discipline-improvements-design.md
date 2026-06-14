# Session-Discipline Improvements — Design

**Date:** 2026-06-14
**Status:** Approved, pending implementation plan

## Background

Analysis of the 10 most recent Claude Code sessions in this repo (~4.5 MB of
transcripts) surfaced a small set of patterns that recur in nearly every
worktree-based session. Two candidate problems were investigated and found to be
**already solved**, so they are explicitly out of scope:

- **Model cost** — subagents already pin models in frontmatter
  (`explorer`/`verifier` → `haiku`; `implementer`/`test-author`/`planner` →
  `sonnet`). No Opus leakage to fix.
- **Preview-port collision** — `scripts/setup-worktree.mjs` (SessionStart hook)
  already writes a per-worktree `.env.local` with a unique port pair. The single
  session that hit a port collision predated that fix.

This spec addresses the remaining open patterns, grouped into four clusters.

## Goals

Reduce recurring friction, wasted tool calls, and one severe failure mode by
codifying rules and tightening one agent prompt. Every change is to docs, rules,
agent prompts, `.gitignore`, or settings — **no executable behavior changes.**

## Non-goals

- No changes to application source or to the worktree setup/cleanup scripts.
- No new numeric guardrails that are brittle (e.g. fixed tool-call ceilings).
- No re-fixing of the already-solved problems listed above.

## Detailed design

### Cluster 1 — Worktree-lifecycle rules

**Files:** `.claude/rules/worktree-merge.md`, `.claude/rules/delegation-protocol.md`

1. **ExitWorktree discard two-step (#1).** Add an "Exiting the worktree"
   subsection to `worktree-merge.md`. After confirming the branch is merged
   (`git merge-base --is-ancestor HEAD main`), call `ExitWorktree` with
   `discard_changes: true` **in the first call**. The removal warning ("N commits
   will be discarded") is a known false alarm: it counts commits since the
   worktree's creation base, not unmerged work. This promotes the existing
   `worktree-base-is-stale` memory note into an enforced rule.

2. **Wrong-path write after EnterWorktree (#3).** Add a rule to
   `worktree-merge.md`: while a session is isolated in a worktree, every
   Read/Write/Edit path must be worktree-relative
   (under `.claude/worktrees/<name>/`). Never reuse a main-checkout absolute path
   for file operations.

3. **`Explore` vs `explorer` (#4).** Add one line to the fleet section of
   `delegation-protocol.md`: `subagent_type` values are lowercase and must match
   the fleet table exactly. Use the project `explorer`, never the built-in
   `Explore` (which is not haiku-pinned and carries broader tools).

### Cluster 2 — Subagent discipline

**Files:** `.claude/rules/delegation-protocol.md`, `.claude/agents/verifier.md`

4. **Parallel explorers (#2).** Strengthen the existing "Parallelize independent
   work" guidance with a hard self-check and a short example: before dispatching
   any explorer, ask "what other independent questions can I answer now?" and
   batch them as multiple `Agent` tool calls in a single message. Dispatching
   independent explorers sequentially is a defect, not a style choice.

5. **Verifier scope cap (#5).** Add a "Scope (hard limits)" section to
   `verifier.md` with behavioral guardrails (no numeric cap):
   - Never write or edit files.
   - Never run `git checkout`/`commit`/`stash`/`reset` or otherwise mutate git
     state.
   - Never debug beyond reading command output.
   - If a failure's cause is not clear from the command output, report
     `fail: <suite> — <excerpt>` and stop, escalating to the orchestrator. Do not
     chase root cause.

   This directly prevents the worst observed failure: a verifier that ran ~24 min
   / 85 tool calls debugging, mutated git state, left artifacts, and ended with an
   abandoned session.

### Cluster 3 — Test reliability

**Files:** new `.claude/rules/testing-conventions.md`, `.gitignore`

6. **Test-author brief (#6).** Create `testing-conventions.md` documenting:
   - The app uses **hash routing** — Playwright navigation targets are
     `/#/<path>`, not `/<path>`.
   - Scope selectors by `data-testid` or by enclosing form; multiple similar
     dropdowns exist, so unscoped `[role="option"]` selectors are ambiguous.
   - A required brief checklist the orchestrator includes in **every**
     `test-author` dispatch: exact navigation path (including hash), the scoped
     selector, and the state transition to assert.

7. **Artifact leak (#7).** Add `e2e/_*` to `.gitignore` (covers `_probe.spec.ts`,
   `_shot_*.png`, and similar). Add a rule to `testing-conventions.md`: name all
   throwaway diagnostic specs and screenshots with a leading `_` so they are
   auto-ignored, and delete them when done. (The verifier no longer creates such
   files per #5; this is the safety net and the home for legitimate debugging
   probes.)

### Cluster 4 — Permission allowlist

**File:** `.claude/settings.local.json`

8. **git push (#8).** Add `"Bash(git push origin main)"` to the `allow` list,
   removing the recurring manual-push interruption. (Explicitly accepted
   tradeoff: loses the safety prompt before publishing to the default branch.)

## Testing

This change set is docs, rules, agent prompts, `.gitignore`, and settings — there
is **no executable behavior to assert**. Per the delegation protocol's testing
policy, this is the stated exemption ("diffs with genuinely nothing to assert").
Called out here rather than skipped silently.

## Files touched

| File | Change |
|------|--------|
| `.claude/rules/worktree-merge.md` | #1 exit-with-discard rule, #3 worktree-relative-path rule |
| `.claude/rules/delegation-protocol.md` | #4 subagent_type casing, #2 parallel-explorer self-check |
| `.claude/agents/verifier.md` | #5 "Scope (hard limits)" section |
| `.claude/rules/testing-conventions.md` (new) | #6 hash-routing + selector conventions + brief checklist, #7 `_`-prefix probe rule |
| `.gitignore` | #7 add `e2e/_*` |
| `.claude/settings.local.json` | #8 allow `Bash(git push origin main)` |
