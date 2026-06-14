# Session-Discipline Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Codify eight recurring-friction fixes (worktree lifecycle, subagent discipline, test reliability, one permission) as rule/prompt/config edits.

**Architecture:** All changes are to docs, rules, agent prompts, `.gitignore`, and settings — no executable behavior. Each task edits one or two files and verifies the edit landed (text present / valid JSON / gitignore match), then commits. No application tests apply (see "Testing" below).

**Tech Stack:** Markdown rules under `.claude/rules/`, agent prompts under `.claude/agents/`, JSON settings, `.gitignore`.

**Testing:** This change set has no executable behavior to assert — per the delegation protocol's testing policy this is the stated exemption. Verification per task is limited to confirming the edit landed (grep for inserted text, JSON validity, `git check-ignore`). No Vitest/Playwright tests are added.

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `.claude/rules/worktree-merge.md` | Finish-time worktree merge procedure | #1 single-call discard refinement; #3 worktree-relative paths note |
| `.claude/rules/delegation-protocol.md` | Orchestrator delegation rules + fleet | #4 subagent_type casing; #2 parallel-explorer self-check |
| `.claude/agents/verifier.md` | Verifier agent prompt | #5 "Scope (hard limits)" section closing the Bash loophole |
| `.claude/rules/testing-conventions.md` (new) | Playwright test conventions + brief checklist | #6 hash routing + selectors + brief checklist; #7 `_`-prefix probe rule |
| `.gitignore` | Ignored paths | #7 add `e2e/_*` |
| `.claude/settings.local.json` | Local permission allowlist | #8 allow `Bash(git push origin main)` |

---

### Task 1: Worktree-lifecycle rules (#1, #3) — `.claude/rules/worktree-merge.md`

**Files:**
- Modify: `.claude/rules/worktree-merge.md` (existing removal-warning section at lines 17–39; step 5 at lines 76–83)

- [ ] **Step 1: Refine the removal-warning section for a single-call discard (#1)**

Replace the final paragraph of the "## The removal warning is expected — verify, then discard" section. The current text ends with:

```markdown
If both are `0`, the commits are safe on `main` (and on `origin`); re-invoke
removal with `discard_changes: true`. "Discard" refers only to the worktree's
copy of the branch — the commits themselves live on `main`.
```

Replace that paragraph with:

```markdown
If both are `0`, the commits are safe on `main` (and on `origin`). Because the
warning **always** fires and you have just done the verification it asks for,
call `ExitWorktree` (or the removal) with `discard_changes: true` in the **first
call** — do not make a bare `action: "remove"` call just to trigger the warning
and then retry. "Discard" refers only to the worktree's copy of the branch — the
commits themselves live on `main`.
```

- [ ] **Step 2: Add a "Paths while isolated" note (#3)**

Insert this section immediately after the title block, before "## Why the push matters" (i.e. after line 7):

```markdown
## Paths while isolated

While a session is isolated in a worktree, every Read/Write/Edit path must be
worktree-relative — under `.claude/worktrees/<name>/`. Never reuse a
main-checkout absolute path for file operations; the isolation guard will reject
it and cost a round-trip. Confirm the current working directory before the first
write.

```

- [ ] **Step 3: Verify both edits landed**

Run: `grep -c "first call" .claude/rules/worktree-merge.md && grep -c "Paths while isolated" .claude/rules/worktree-merge.md`
Expected: each prints `1` (or higher).

- [ ] **Step 4: Commit**

```bash
git add .claude/rules/worktree-merge.md
git commit -m "docs: single-call worktree discard + worktree-relative paths rule"
```

---

### Task 2: Subagent discipline rules (#4, #2) — `.claude/rules/delegation-protocol.md`

**Files:**
- Modify: `.claude/rules/delegation-protocol.md` ("## The fleet" section; the "Parallelize independent work" bullet under "## Delegating for token savings")

- [ ] **Step 1: Add the subagent_type casing rule (#4)**

Immediately after the fleet table (the row ending with `verifier | Haiku | All test/typecheck/lint/build runs...`), and before the line beginning "For anything that doesn't fit...", insert:

```markdown

**`subagent_type` is lowercase and must match the fleet table exactly**
(`explorer`, `planner`, `implementer`, `test-author`, `verifier`). Do not use the
built-in `Explore` agent when you mean the project `explorer` — `Explore` is not
haiku-pinned and carries broader tools, so it is slower and costlier for the
read-only digests the fleet `explorer` is tuned for.
```

- [ ] **Step 2: Strengthen the parallelize bullet (#2)**

Find this bullet under "## Delegating for token savings":

```markdown
- **Parallelize independent work.** Spawn multiple `explorer`s for different questions, or multiple `implementer`s for independent units, in a single message. Use worktree isolation only if they'd edit overlapping files.
```

Replace it with:

```markdown
- **Parallelize independent work.** Before dispatching *any* explorer, ask: "what other independent questions can I answer right now?" Batch them as multiple `Agent` tool calls in a **single message** — spawn multiple `explorer`s for different questions, or multiple `implementer`s for independent units, at once. Dispatching independent explorers in sequential turns is a defect, not a style choice: each sequential dispatch adds a full round-trip. Use worktree isolation only if they'd edit overlapping files.
```

- [ ] **Step 3: Verify both edits landed**

Run: `grep -c "must match the fleet table exactly" .claude/rules/delegation-protocol.md && grep -c "is a defect, not a style choice" .claude/rules/delegation-protocol.md`
Expected: each prints `1`.

- [ ] **Step 4: Commit**

```bash
git add .claude/rules/delegation-protocol.md
git commit -m "docs: enforce lowercase subagent_type + parallel-explorer self-check"
```

---

### Task 3: Verifier scope cap (#5) — `.claude/agents/verifier.md`

**Files:**
- Modify: `.claude/agents/verifier.md` (after the "## Rules" list, before "## What to return")

- [ ] **Step 1: Add the "Scope (hard limits)" section**

Insert this section between the "## Rules" list (ends at the "Be token-frugal" bullet) and "## What to return":

```markdown
## Scope (hard limits)

You are a gate, not a debugger. Even though you have `Bash`, you must not use it
to mutate anything:

- **Never write or edit files** — no `>`, `>>`, `tee`, `printf >`, generated spec
  files, or screenshots you keep.
- **Never mutate git state** — no `git checkout`, `commit`, `stash`, `reset`,
  `add`, or branch changes.
- **Never debug beyond reading command output.** Run the requested checks, read
  what they print, and report. Do not iterate hypotheses, add logging, or rerun
  variations to chase a root cause.
- **If a failure's cause is not clear from the output, stop.** Report
  `fail: <suite> — <excerpt>` and hand back to the orchestrator. Investigation is
  the orchestrator's call (it will dispatch an `explorer` or `implementer`); it is
  not yours.
```

- [ ] **Step 2: Verify the edit landed**

Run: `grep -c "Scope (hard limits)" .claude/agents/verifier.md && grep -c "You are a gate, not a debugger" .claude/agents/verifier.md`
Expected: each prints `1`.

- [ ] **Step 3: Commit**

```bash
git add .claude/agents/verifier.md
git commit -m "docs: cap verifier scope — gate only, no file/git mutation or debugging"
```

---

### Task 4: Test reliability (#6, #7) — new `testing-conventions.md` + `.gitignore`

**Files:**
- Create: `.claude/rules/testing-conventions.md`
- Modify: `.gitignore` (append one line after `.claude/worktrees/`)

- [ ] **Step 1: Create the testing-conventions rule (#6, #7)**

Create `.claude/rules/testing-conventions.md` with exactly this content:

```markdown
# Testing conventions

Conventions for writing and dispatching tests in this repo. The orchestrator must
fold the relevant items into every `test-author` brief.

## Playwright (e2e)

- **Hash routing.** The app uses hash-based routing. Navigation targets are
  `/#/<path>` (e.g. `/#/projects`), **not** `/<path>`. A test that navigates to a
  bare path lands on the wrong view.
- **Scope selectors.** Multiple similar controls exist (e.g. several nature/ability
  dropdowns). Never use an unscoped selector like `[role="option"]` — scope by
  `data-testid` or by the enclosing form/section so the selector is unambiguous.

## Required `test-author` brief checklist

Every `test-author` dispatch for an e2e test must state:

1. The exact navigation path, including the `#` hash.
2. The scoped selector for the element(s) under test.
3. The state transition or assertion the test must verify.

## Diagnostic probes and screenshots

Throwaway diagnostic specs and screenshots (selector discovery, screenshot
inspection) must be named with a leading underscore — `e2e/_probe.spec.ts`,
`e2e/_shot_*.png` — so they are auto-ignored (see `.gitignore`'s `e2e/_*`). Delete
them when the investigation is done. The `verifier` never creates such files
(see `.claude/agents/verifier.md`); legitimate probes belong to a debugging
`explorer`/`implementer` and use the `_` prefix.
```

- [ ] **Step 2: Append the gitignore entry (#7)**

Add the line `e2e/_*` to `.gitignore` immediately after the existing `.claude/worktrees/` line.

- [ ] **Step 3: Verify both edits landed**

Run: `git check-ignore e2e/_probe.spec.ts e2e/_shot_1.png && grep -c "Required \`test-author\` brief checklist" .claude/rules/testing-conventions.md`
Expected: the two `e2e/_*` paths are echoed (matched by gitignore) and the grep prints `1`.

- [ ] **Step 4: Commit**

```bash
git add .claude/rules/testing-conventions.md .gitignore
git commit -m "docs: add testing conventions (hash routing, selectors, probe artifacts)"
```

---

### Task 5: Permission allowlist (#8) — `.claude/settings.local.json`

**Files:**
- Modify: `.claude/settings.local.json` (add one entry to `permissions.allow`)

- [ ] **Step 1: Add the git push permission**

The current file is:

```json
{
  "permissions": {
    "allow": [
      "Bash(git commit *)",
      "Bash(xargs ls -la)",
      "Skill(update-config)"
    ]
  }
}
```

Add `"Bash(git push origin main)"` as the first entry of the `allow` array, so it becomes:

```json
{
  "permissions": {
    "allow": [
      "Bash(git push origin main)",
      "Bash(git commit *)",
      "Bash(xargs ls -la)",
      "Skill(update-config)"
    ]
  }
}
```

- [ ] **Step 2: Verify valid JSON and entry present**

Run: `node -e "const j=require('./.claude/settings.local.json'); if(!j.permissions.allow.includes('Bash(git push origin main)')) throw new Error('missing'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add .claude/settings.local.json
git commit -m "chore: allow git push origin main in local permissions"
```

---

## Self-Review

**Spec coverage:** All 8 spec items map to tasks — #1/#3 → Task 1; #4/#2 → Task 2; #5 → Task 3; #6/#7 → Task 4; #8 → Task 5. No gaps.

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every edit shows exact text. OK.

**Type/name consistency:** No code symbols introduced. File paths consistent across plan and spec. The `e2e/_*` gitignore glob matches the `_`-prefix naming in Task 4's rule text. OK.
