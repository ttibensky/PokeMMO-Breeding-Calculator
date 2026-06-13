---
name: commit
description: Commit staged changes. Dispatches a sub-agent (Sonnet) to draft a Conventional Commits message and run git commit. Use when the user says "/commit", "commit staged changes", "commit these", or obvious variants.
---

# /commit

Shortcut for committing already-staged changes. Also fires on the trigger phrase **"commit staged changes"** and obvious variants (`"commit these"`, `"commit this"`, `"commit it"`).

## What this skill does

Dispatches **one** sub-agent to draft a Conventional Commits message and run `git commit` against the already-staged set. The main session does **not** run `git commit` inline.

## How to invoke (main session)

Call `Agent` with:

- `subagent_type: "general-purpose"`
- `model: "haiku"`
- `description`: `"Commit staged changes"`
- `prompt`: the template below

### Prompt template

````
Your job: commit whatever is already staged in the git repository at the current working directory.

**Commit message format** — follow the Conventional Commits format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`, `revert`.
`feat` = new feature (MINOR), `fix` = bug fix (PATCH). Breaking changes append `!` after the type/scope, e.g. `feat!: drop support for Node 12`. Examples: `feat(auth): add OAuth2 login`, `fix: prevent race condition in queue`, `chore: update dependencies`.

Steps:

0. NEVER create, switch, or rename a git branch. Commit on the currently
   checked-out branch — that is always correct here.
1. Run `git status` (never `-uall`) and `git diff --cached --stat`.
   If nothing is staged, stop and report back — NEVER run `git add`.
   Staging is the user's decision; `/commit` alone is NOT staging authorization.
2. If anything looks accidentally staged or accidentally unstaged, stop and
   surface both lists for the user to review.
3. Skim `git log --oneline -10` to match the repo's existing tone and scope usage.
4. Draft a Conventional Commits message based on the staged diff, then run:

   git commit -m "$(cat <<'EOF'
   <type>(<scope>): <description>

   <body if warranted>

   Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
   EOF
   )"

5. On success, run `git log -1 --format='%H %s'` and report the SHA + subject.
6. If the commit hook rejects the message, fix it and re-commit (no --no-verify,
   no --amend). Stop after two consecutive failures and report the error.

Report back: the commit SHA + subject (one line), or a clear refusal naming
which step stopped you.
````

## After the sub-agent returns

- On success: surface the commit SHA + subject to the user. Done.
- On refusal (nothing staged, suspicious staging, hook rejection): surface the sub-agent's report verbatim and ask the user how to proceed. Do not retry inline.
