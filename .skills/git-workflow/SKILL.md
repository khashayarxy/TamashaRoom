---
name: git-workflow
description: Safe Git workflow for TamashaRoom — when to commit, what must never be staged, pre-commit verification, pre-push audit, and destructive-command guardrails. Use before any commit/push, when asked to commit or push work, or when recovering from a git mistake.
---

# Git Workflow & Safety

TamashaRoom keeps its full history on `origin/master` (GitHub). Every rule
below exists because a bad git command on this repo costs real history —
and the repo was audited for exactly these failure modes before first push.

## Standing Rule — Local Verification Is Fast-Only; CI Owns E2E & Full A11y

Do **not** run the full local E2E suite (`npm run test:e2e`) or the full a11y
suite (`npm run test:a11y`) as part of routine verification. The E2E suite
takes 1.5+ hours serially on the dev machine — that is CI's job.

- **Local fast checks (run every time, before considering work ready):**
  `php artisan test` (backend), `npm run test` (frontend unit),
  `npm run lint`, `npm run type-check`,
  `./vendor/bin/pint --dirty --format agent`, and
  `npm run test:a11y:contrast` (the fast targeted a11y check).
- **E2E and full a11y:** verified exclusively by the GitHub Actions `CI`
  workflow (`.github/workflows/ci.yml`) after push — monitor it per
  "After Any Push" below. Do not treat a local run as a substitute, and do
  not block local work waiting on one.
- **When CI reports an E2E/a11y failure:** diagnose from the CI logs and
  uploaded artifacts (`test-results`, traces, screenshots) — not by
  re-running the full suite locally. If local reproduction is needed, run
  ONLY the specific failing spec file/test by name (targeted single-spec
  runs are fast and fine). Fix, commit, push, and re-check CI until green.

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
4. Run the relevant checks for what changed — but per the standing rule above,
   local verification is **fast-only**: backend/frontend unit suites, lint,
   type-check, Pint, and (for `resources/js/Components/**` or
   `resources/js/Pages/**` changes) `npm run test:a11y:contrast`. Never run
   `npm run test:e2e` or the full a11y suite locally as routine pre-commit
   verification — CI is the sole source of truth for those after push.
   Command names come from AGENTS.md Commands / `package.json`; don't invent
   them. Don't commit code that fails its checks.
5. Stage **only the intended files** with explicit paths
   (`git add app/... tests/...`). Use `git add -A` only after reviewing
   `git status` and confirming everything present is intended.
6. `git diff --cached --check` and `git diff --cached --stat` — verify the
   staged set is exactly what you intend.

## Before Any Push

1. `git log --oneline -5` and `git status -sb` — know what will be pushed.
2. Confirm no secrets/artifacts staged (`git diff --cached --name-only`).
3. Push only `master` to `origin`: `git push origin master`.

## After Any Push — CI Is Part of the Commit Cycle

- **A commit/push cycle is not finished until the triggered GitHub Actions
  run is green.** The push `master` to `origin` triggers the `CI` workflow
  (see `.github/workflows/ci.yml`); polling it is mandatory, not optional.
- Right after pushing, identify the run: `gh run list --limit 1 --json
  databaseId,status,conclusion,headSha` (match `headSha` to the pushed commit
  if multiple runs are in flight).
- Poll until it reaches a terminal state:
  `gh run watch <databaseId> --exit-status` (blocking) or poll
  `gh run view <databaseId> --json status,conclusion` until
  `status == "completed"`. On `conclusion == "success"`, the cycle is done.
- **If the run fails:** download the log
  (`gh run view <databaseId> --log --job <jobId>`) and read the failing
  step's actual error before changing anything — do not guess. Diagnose from
  the CI logs/artifacts first. For E2E/full-a11y failures, do NOT re-run the
  full suite locally — if a local reproduction is needed, run only the
  specific failing spec by name (see the standing rule at the top). Fix,
  commit the fix (with its `docs/TASK.md` update), push again, and wait for
  THAT run to go green too. Repeat until green.
- Log download can hit `net/http: TLS handshake timeout` on networks behind a
  system proxy (TAM-015); retry once or twice — it usually succeeds — or pull
  the annotations instead: `gh api repos/khashayarxy/TamashaRoom/check-runs/<jobId>/annotations`.
- Contrast-step (`test:a11y:contrast`) failures are often timing-sensitive,
  not logic regressions — and that suite IS fast locally: reproduce the
  failing spec at least twice in a row locally before concluding a fix, to
  confirm it is not flaky.

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
