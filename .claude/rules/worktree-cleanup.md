# Worktree cleanup at finish time

When a worktree's branch is merged to `main` or a PR is created (e.g. during the
`superpowers:finishing-a-development-branch` flow), the worktree's node processes
(dev/preview servers, vitest workers, esbuild) must be terminated — otherwise
they leak memory and CPU.

- **On worktree removal:** handled automatically by the `WorktreeRemove` hook in
  `.claude/settings.json`, which runs `scripts/cleanup-worktree.mjs --stdin`.
- **On merge/PR where the worktree dir is kept:** the `WorktreeRemove` hook does
  NOT fire, so run cleanup explicitly as the final step:

  ```bash
  npm run cleanup:worktree -- <worktree-name>
  ```

  Use the worktree's directory name under `.claude/worktrees/` (e.g.
  `worktree-process-cleanup`).
