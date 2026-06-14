# Worktree merge at finish time

When finishing a worktree by integrating its branch into `main` (the local-merge
path of `superpowers:finishing-a-development-branch`), use this procedure instead
of the generic `checkout main → pull → merge → delete` flow. It keeps `main`
linear and — critically — **pushes `main` to `origin` so `origin/main` never
goes stale.**

## Paths while isolated

While a session is isolated in a worktree, every Read/Write/Edit path must be
worktree-relative — under `.claude/worktrees/<name>/`. Never reuse a
main-checkout absolute path for file operations; the isolation guard will reject
it and cost a round-trip. Confirm the current working directory before the first
write.

## Why the push matters

New worktrees are created by `EnterWorktree`, which branches from
**`origin/main`** by default. If you merge into local `main` but never push,
`origin/main` lags and **new worktrees start stale** — missing your latest
merged commits. Pushing `main` after every merge keeps `origin/main`
authoritative so each new worktree branches from current history.

## The removal warning is expected — verify, then discard

Pushing does **not** silence the worktree-removal warning:

> `Worktree has N commits on <branch>. Removing will discard this work permanently.`

The removal check counts commits the branch added **since the worktree's
creation base** — not commits unreachable from `origin/main` or `main`. So it
fires for *any* worktree that committed work, even one fully merged **and**
pushed (verified: a branch at the exact same SHA as `origin/main` still warns).

This is a false alarm once the work is integrated. Confirm that explicitly, then
discard:

```bash
# Both must print 0 — nothing is actually unintegrated:
git rev-list --count origin/main..<branch>
git rev-list --count main..<branch>
```

If both are `0`, the commits are safe on `main` (and on `origin`). Because the
warning **always** fires and you have just done the verification it asks for,
call `ExitWorktree` (or the removal) with `discard_changes: true` in the **first call** — do not make a bare `action: "remove"` call just to trigger the warning
and then retry. "Discard" refers only to the worktree's copy of the branch — the
commits themselves live on `main`.

## Procedure

Let `<branch>` be the worktree's branch and `<main-root>` the main checkout
(`git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel`).

1. **Make local `main` current** (from the main root, so the branch stays
   checked out in its worktree):

   ```bash
   git -C <main-root> checkout main
   git -C <main-root> pull
   ```

2. **Rebase the branch onto `main` — inside the worktree.** Git refuses to
   rebase a branch that's checked out in another worktree, so run this from the
   worktree directory. Resolve any conflicts here, on the branch — `main` stays
   pristine:

   ```bash
   git rebase main
   ```

3. **Re-run the full test suite** on the rebased branch and confirm green before
   integrating (`verifier` gate).

4. **Fast-forward `main` and push** — from the main root. Because the branch was
   just rebased onto `main`, this is a guaranteed fast-forward: linear history,
   no merge commit.

   ```bash
   cd <main-root>
   git merge --ff-only <branch>
   git push origin main
   ```

5. **Clean up:** verify the branch is fully integrated (see *The removal warning*
   above), then remove the worktree with `discard_changes: true` (via
   `ExitWorktree` / the `WorktreeRemove` hook, see
   [worktree-cleanup.md](worktree-cleanup.md)) and delete the branch:

   ```bash
   git branch -d <branch>
   ```
