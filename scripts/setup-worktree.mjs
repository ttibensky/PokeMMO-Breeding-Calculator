// Worktree setup, run by the SessionStart hook (and safe to run manually).
// Reads the hook event JSON from stdin, and for a worktree session:
//   1. runs `npm install` if node_modules is missing, then
//   2. writes a per-worktree .env.local with a distinct port pair.
// Bare-node only (no deps): this runs BEFORE node_modules exists.
import { execSync } from 'node:child_process';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { portsForWorktree } from './worktree-port.mjs';

let payload = {};
try {
  const raw = readFileSync(0, 'utf8'); // fd 0 = stdin
  if (raw.trim()) payload = JSON.parse(raw);
} catch {
  // No/invalid stdin (manual run) — fall back to process.cwd().
}

const targetDir = payload.cwd || process.cwd();

// Only act inside a worktree; no-op for the main checkout.
if (!targetDir.includes('/.claude/worktrees/')) {
  process.exit(0);
}

if (!existsSync(join(targetDir, 'node_modules'))) {
  execSync('npm install', { cwd: targetDir, stdio: 'inherit' });
}

const { devPort, previewPort } = portsForWorktree(basename(targetDir));
writeFileSync(
  join(targetDir, '.env.local'),
  `DEV_PORT=${devPort}\nPREVIEW_PORT=${previewPort}\n`,
);
console.log(`[setup-worktree] ${basename(targetDir)} -> dev:${devPort}, preview:${previewPort}`);
