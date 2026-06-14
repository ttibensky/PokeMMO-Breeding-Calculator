# Delegation protocol (orchestrator mode)

You (the main session) run on Opus and act as an **orchestrator**, not a worker. Your token budget is the expensive one — keep grunt work and bulky context out of your window by delegating it to cheaper, model-pinned subagents.

## The hard rule

**Delegate all code reading, writing, and verification to subagents — always, even for a single file.** You do not read files, edit files, write tests, or run verification commands directly. You decide *what* needs doing, delegate it, judge the results, and talk to the user.

Narrow exceptions where you may act directly:
- Reading a subagent's returned digest (that's their output, not a file read).
- A trivial one-line lookup where spawning an agent genuinely costs more than it saves (e.g. confirming a single path you already half-know). When in doubt, delegate.
- Writing/editing files under `.claude/` (agents, rules, settings) and other meta-configuration of this workflow itself.

## The fleet

| Agent | Model | Use for |
|---|---|---|
| `explorer` | Haiku | All code reading, searching, "how does X work", locating things. Returns digests. |
| `planner` | Sonnet | Drafting a first-pass implementation plan from digests. You refine its draft. |
| `implementer` | Sonnet | All code writing/editing. One agent per independent unit. |
| `test-author` | Sonnet | All test writing — e2e (Playwright) for behavioral changes, unit (Vitest) for everything else. |
| `verifier` | Haiku | All test/typecheck/lint/build runs. Hard gate: the full suite must pass before a task is "done". |

**`subagent_type` is lowercase and must match the fleet table exactly**
(`explorer`, `planner`, `implementer`, `test-author`, `verifier`). Do not use the
built-in `Explore` agent when you mean the project `explorer` — `Explore` is not
haiku-pinned and carries broader tools, so it is slower and costlier for the
read-only digests the fleet `explorer` is tuned for.

For anything that doesn't fit, spawn an ad-hoc `Agent` with an explicit `model` (prefer Haiku for read/inspect, Sonnet for write).

## What stays on Opus (never delegated)

- **Final plan ownership** — you may delegate a *first-pass draft* to `planner`, but you synthesize the final plan, resolve its open questions, and own the architectural calls.
- **All user interaction** — clarifying requirements, iterating on gaps, presenting results. Subagents cannot talk to the user.
- **Judgment calls** — deciding whether verification results are acceptable, choosing between approaches, resolving subagent-reported blockers.

## Testing policy (mandatory)

**Every change adds or updates tests — no code task is "done" without them.** This is not optional and not subject to token-saving shortcuts.

- **User-facing / behavioral change** (routing, rendering, navigation, i18n, a11y, SEO, responsive behavior — anything observable in the running app) → **e2e** with Playwright (`/e2e/`, `npm run test:e2e`). Use judgment: extend the most relevant existing spec before adding a new one.
- **Everything else** (pure functions, utils, data/transform logic, hooks, non-visual units) → **unit tests** with Vitest (co-located `*.test.ts(x)` next to the source file, `npm run test:unit`).
- **"Add or update"** absorbs refactors: when behavior is unchanged, update the existing tests to match the new shape rather than inventing new ones.
- **Only exemption:** diffs with genuinely nothing to assert (pure docs, comments, config with no behavior). When you skip tests, say so explicitly and why — never skip silently.

Test *writing* goes to `test-author`. Test *running/gating* goes to `verifier`. Never collapse the two — the verifier's value is being an independent oracle that never edits code.

### The verifier is a hard gate
A code task is complete only when `verifier` reports the relevant suite green: `test:unit` + `test:e2e` + typecheck (`tsc -b`) + lint (`eslint .`). A failure attributable to the change blocks completion and triggers escalation — never hand work to the user as "done" with a red check. A check that was **already failing before the change** is reported as pre-existing: it doesn't by itself block the new work, but you surface it to the user rather than absorbing it silently.

## Delegating for token savings

The win is keeping bulky context out of your window — so delegate *well*:
- **Ask precise questions, not "read this file."** "What's the signature and call sites of `X`?" returns a tight digest; "read foo.ts" returns noise.
- **Demand digests, not dumps.** The agents are instructed to return `path:line` + summaries. Don't ask them to echo file contents back.
- **Give implementers a complete, self-contained spec** so they don't have to re-explore what you already know. Pass along the relevant `path:line` facts from exploration.
- **Parallelize independent work.** Before dispatching *any* explorer, ask: "what other independent questions can I answer right now?" Batch them as multiple `Agent` tool calls in a **single message** — spawn multiple `explorer`s for different questions, or multiple `implementer`s for independent units, at once. Dispatching independent explorers in sequential turns is a defect, not a style choice: each sequential dispatch adds a full round-trip. Use worktree isolation only if they'd edit overlapping files.
- **Relay, don't paste.** Summarize subagent results for the user; don't dump their full output.

## Escalation (when a subagent struggles)

Start every task at its default (cheap) tier. **Escalate only on a detected problem** — never preemptively, or you lose the token savings.

**Triggers** (any one):
- `verifier` reports a failure attributable to the unit.
- A subagent self-reports a blocker, ambiguity, or low confidence (the workers are instructed to flag this).
- You review the result/digest and find it wrong, incomplete, or off-spec.
- The same task already failed once at the current tier.

**Two knobs, escalated together on re-spawn:**
1. **Model tier** — re-run the *same agent type* with an overridden, stronger model:
   - read/inspect (`explorer`): Haiku → Sonnet → Opus
   - plan/implement/test (`planner`/`implementer`/`test-author`): Sonnet → Opus
2. **Reasoning effort** — add explicit cues to the re-spawn prompt ("think hard about the edge cases", "reason step by step before editing"). Raise effort *and* tier together — a sharper spec plus more thinking often fixes it without going all the way to Opus.

**Always also sharpen the spec** on re-spawn: feed back exactly what went wrong, the failing output, and the constraint that was missed. A re-run with the same vague prompt just fails again.

**Stop conditions — do not loop forever:**
- Max **2 escalations** per unit (e.g. Sonnet → Opus-with-effort).
- If it still fails at the top tier, **STOP and bring it to the user** with your diagnosis and options. Do not silently retry, and do not quietly take it over yourself.

## Typical flow

1. **Explore** → fan out `explorer` agents (Haiku) for the questions you need answered.
2. **Plan** → optionally delegate a first-pass draft to `planner` (Sonnet); you (Opus) refine it into the final plan.
3. **Iterate on gaps** → you, with the user.
4. **Implement** → `implementer` agents (Sonnet), one per independent unit, in parallel where possible.
5. **Test** → `test-author` agents (Sonnet) — **mandatory** per the Testing policy: e2e for behavioral changes, unit for everything else; always add or update.
6. **Verify** → `verifier` agent (Haiku) gates on the relevant suite green (unit + e2e + typecheck + lint); you judge the result, distinguish new failures from pre-existing, and decide next steps.
