---
name: git-workflow
description: Safe Git workflow for TamashaRoom — when to commit, what must never be staged, pre-commit verification, pre-push audit, and destructive-command guardrails. Use before any commit/push, when asked to commit or push work, or when recovering from a git mistake.
---

# Git Workflow & Safety

TamashaRoom keeps its full history on `origin/master` (GitHub). Every rule
below exists because a bad git command on this repo costs real history —
and the repo was audited for exactly these failure modes before first push.

## When to Commit

- **Only commit when the user explicitly asks.** Never commit or push as a
  side effect of "finishing" a task.
- One logical unit per commit; conventional-commit message format
  (`type(scope): description`) — see `output-conventions` for the type table.
- If `docs/TASK.md` tracks the work (it should), the commit that completes a
  unit of work includes the TASK.md update for it.

## What Must NEVER Be Staged or Committed

- `.env` or any environment file with real values (`.env.example` with
  placeholders is fine and tracked).
- Secrets, API keys, tokens, private keys, credentials — in any file, at
  any depth, including inside docs and test fixtures.
- Generated/runtime artifacts: `node_modules/`, `vendor/`, `public/build/`,
  `storage/` runtime files (logs, framework cache/sessions/views),
  `.phpunit.result.cache`, `coverage/`, `test-results/`.
- Local IDE files, scratch files, or anything matching `.gitignore`
  patterns. If unsure whether a file should be committed, ask — never guess.

## Before Any Commit

1. `git status` — confirm exactly which files changed and that none are
   secrets/artifacts.
2. `git diff` — read the actual diff, not just the stat.
3. `git diff --check` — must be clean (whitespace errors). Exception:
   known pre-existing markdown hard-break trailing whitespace in
   `docs/SYSTEM.md` is accepted and documented.
4. Run the relevant checks for what changed — follow `testing-strategy`
   "Verification Escalation" (Levels 1–4): start at the static/format/lint
   checks for the edited files, escalate only as the change warrants.
   **Crucial guardrail:** when modifying `resources/js/Components/**` or
   `resources/js/Pages/**`, always run `npm run test:a11y:contrast` locally before
   committing to catch DOM/contrast regressions before CI. Command names come
   from AGENTS.md Commands / `package.json`; don't invent them. Don't commit
   code that fails its checks.
5. Stage **only the intended files** with explicit paths
   (`git add app/... tests/...`). Use `git add -A` only after reviewing
   `git status` and confirming everything present is intended.
6. `git diff --cached --check` and `git diff --cached --stat` — verify the
   staged set is exactly what you intend.

## Before Any Push

1. `git log --oneline -5` and `git status -sb` — know what will be pushed.
2. Confirm no secrets/artifacts staged (`git diff --cached --name-only`).
3. Push only `master` to `origin`: `git push origin master`.

## Destructive-Command Guardrails

- **Never** `git push --force` / `--force-with-lease` unless the user
  explicitly authorizes it for a specific reason.
- **Never** `git reset --hard`, `git clean -fd`, or `git checkout -- .`
  — they discard user work irreversibly. If cleanup is needed, ask first.
- **Never** `git commit --amend` an already-pushed commit (rewrites history
  that others may have).
- **Never** delete or rename branches/pushed refs without explicit approval.
- To recover from a mistake: `git reflog` + `git checkout <commit> -- <path>`
  are safe, reversible operations. Report what happened and ask before acting.

## Pre-Push Audit Sequence (the verified one from this repo's history)

When asked to do a final pre-push check, run in order:

```bash
git branch --show-current        # must be master
git status --short               # confirm intended working set only
git diff --cached --name-only | findstr /I ".env"   # must be empty
# forbidden dirs must NOT appear in staged names:
# node_modules/, vendor/, public/build/, storage/, .phpunit.result.cache
git diff --cached --stat
git diff --cached --check
```

If anything unexpected appears: **STOP. Do not commit. Do not push.** Report
the exact finding and ask.

## If a Push Fails

- Do NOT force-push, reset, or amend.
- Report the exact error and stop. If the remote moved, `git fetch origin`
  and inspect `git log origin/master..master` before deciding anything.
