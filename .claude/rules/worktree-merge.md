# Worktree merge at finish time

When finishing a worktree by integrating its branch into `main` (the local-merge
path of `superpowers:finishing-a-development-branch`), use this procedure instead
of the generic `checkout main → pull → merge → delete` flow. It keeps `main`
linear and — critically — **pushes `main` to `origin` so `origin/main` never
goes stale.**

## Why the push matters

New worktrees are created by `EnterWorktree`, which branches from
**`origin/main`** by default. The worktree-removal safety check also compares
against `origin/main`. If you merge into local `main` but never push, then
`origin/main` lags and:

- new worktrees start stale (missing your latest merged commits), and
- removing a fully-merged worktree triggers a false *"N commits will be lost"*
  alarm, because those commits aren't reachable from the stale `origin/main`.

Pushing `main` after every merge keeps `origin/main` authoritative and makes
both problems disappear.

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

5. **Clean up:** remove the worktree (via `ExitWorktree` / the `WorktreeRemove`
   hook, see [worktree-cleanup.md](worktree-cleanup.md)) and delete the branch:

   ```bash
   git branch -d <branch>
   ```

After step 4, `origin/main == main` and `<branch>` is fully reachable from
`origin/main`, so worktree removal reports no lost commits — no false alarm, no
`discard_changes: true` needed.
