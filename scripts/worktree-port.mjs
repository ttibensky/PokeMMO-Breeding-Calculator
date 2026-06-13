// Deterministic, stateless port assignment for git worktrees.
// Main checkout (not a worktree) uses 3000/3001 — see vite.config.ts defaults.
// Each worktree hashes its directory name into a distinct even/odd port pair.
export function portsForWorktree(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (Math.imul(hash, 31) + name.charCodeAt(i)) >>> 0;
  }
  const slot = (hash % 90) + 1; // 1..90
  const devPort = 3000 + slot * 2; // even: 3002, 3004, … 3180
  return { devPort, previewPort: devPort + 1 };
}
