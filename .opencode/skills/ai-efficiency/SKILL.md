---
name: ai-efficiency
description: How to minimize AI context/token usage while working in TamashaRoom — progressive disclosure, never repeating established context, efficient task-prompt construction, what to read first, targeted exploration and test execution, and avoiding re-reading known files. Use at the start of any task, when drafting a prompt for another agent, or whenever a task involves exploring the repo or reading docs.
---

# AI Efficiency (Token & Context Optimization)

The goal: spend tokens on *deciding and verifying*, not on *re-reading or
restating what is already known*. Every token spent restating known facts is
a token not spent reasoning about the actual problem.

## Progressive Disclosure — Read in This Order

1. `AGENTS.md` — always loaded; contains the stack, constraints, and the
   skill table. Read it once, trust it.
2. The **one skill** that matches the task (load it via the skill tool, not
   by opening the file manually).
3. Only the **specific chapter** of `docs/SYSTEM.md` the skill points to —
   never the whole 10,000-line file.
4. The actual source files, via targeted searches first.

**Never read whole files you only need a slice of.** Use grep/glob to locate
the exact function, then read only that window. `docs/SYSTEM.md` is the
biggest trap — it is the full spec and should almost never be read end to end.

## Do Not Repeat Established Context

Project context is established once, in `AGENTS.md` and the skills. Do not
re-produce it per task:

- **Do not restate** the stack, hosting constraints, polling architecture,
  deployment model, or previously verified decisions in every prompt or
  reply. The user and any other agent already have them.
- **Do not re-derive what a skill already says.** If `laravel-backend-rules`
  covers the polling pattern, reference "per the existing polling
  architecture" instead of re-explaining it.
- **Do not ask the user to restate a task** that the repository's
  documentation (`docs/TASK.md`, docs, skills) already defines. Search first;
  ask only when the repo genuinely does not answer.
- **Do not rediscover facts verified earlier in the same task/session.**
  Once verified, they are established — reference them, don't re-verify.
- **Prefer short references over long explanations**: "per the deployment
  checklist", "as documented in `docs/SYSTEM.md` 18.05", "the existing
  `usePlaybackSync` hook".
- **Avoid duplicate instructions**: if `AGENTS.md` and a skill already
  establish a rule, don't repeat it — point to it.
- When `AGENTS.md`, a skill, and `docs/SYSTEM.md` disagree: code wins over
  docs, SYSTEM.md wins over skills, skills win over AGENTS.md summary.

## What You Already Know (do not re-derive)

- The stack: Laravel 13 + PHP 8.4 + Inertia 2 + React 19 + TS strict + Vite 5.
- The constraint: shared cPanel, 1 core, 2GB RAM, no Redis/WebSockets/
  persistent workers; polling architecture; database-backed
  cache/session/queue.
- The test baseline: PHPUnit **214** (173 Feature + 41 Unit), Vitest **122**,
  E2E **12**, a11y **11** — recounted 2026-08-02. When docs conflict with
  the actual test run, the run wins and the doc needs a correction.
- `docs/TASK.md` is the canonical done/pending record — check it before
  assuming something is unimplemented.

## Efficient Task Prompts

When constructing a prompt (for yourself or another agent), include only:

1. **Objective** — the outcome, in one or two sentences.
2. **Constraints** — only those not already in AGENTS.md/skills (repo rules
   are inherited; do not restate them).
3. **Relevant files/areas** — exact paths or subsystems.
4. **Acceptance criteria** — how to know it's done.
5. **Verification command(s)** — the specific test/lint/type-check to run.
6. **Stop conditions** — what not to do (e.g., "no new dependency", "do not
   commit"), only when they aren't already project rules.

Do **not** pad prompts with generic instructions like "be careful", "don't
break anything", or "follow the architecture" — those rules already exist in
AGENTS.md/skills and cost tokens without adding information. If a rule is
already inherited, the agent reads it from context; the prompt only needs the
task-specific delta.

For prompts handed to another coding agent: include only the context
necessary for that specific task. Prefer file/section references
("see `docs/SYSTEM.md` 18.05") over copying documentation blocks into the
prompt.

## Targeted Exploration Patterns

- **Find a symbol**: grep for the class/function name (include `app/`,
  `resources/js/`) — don't browse directories.
- **Understand a flow**: read the route definition, then the controller,
  then only the service/action it calls. Follow the call chain, don't fan out.
- **Check if something exists**: `Test-Path` / glob — one command, not a search.
- **Check test counts**: count `#[Test]`/`test_*` declarations, don't run the
  full suite just to count.
- **Verify behavior**: run the *filtered* test
  (`php artisan test --filter=ClassName`), not the whole suite, when only one
  area changed.

## Targeted Test Execution

| Change touches | Run |
|---|---|
| One backend class | `php artisan test --filter=ThatTest` |
| Backend broadly | `php artisan test` |
| One frontend module | `npx vitest run path/to/file.test.tsx` |
| Frontend broadly | `npm run test` |
| Nothing frontend | skip `npm run test`/`type-check`/`lint` |

Only run the suites the change can affect. Running everything for a doc edit
is wasted tokens.

## Avoid Re-Reading

- If this session already read a file, don't re-read it unless it may have
  changed (ask: did anyone modify it since?).
- After editing a file, re-read only the edited region, not the whole file.
- Trust your own verified statements from earlier in the session — restating
  "the test count is 214" doesn't require re-running the suite.

## Reports & Outputs

- Report **conclusions and evidence locations** (`file:line`), not verbatim
  dumps of files the user can open.
- When asked for a count or status, give the number and the method used to
  obtain it — that's what makes it verifiable, not the length of the answer.
- Do not copy-paste large doc sections into answers; point to them instead.

## Anti-Patterns Specific to AI Work

- Reading `docs/SYSTEM.md` in full "to be safe" — never; chapter-scoped only.
- Re-running the whole test suite to confirm one change — filtered runs.
- Copying an entire skill or doc into a reply — reference it.
- Re-verifying facts already verified this session without a reason to
  believe they changed.
- Restating the stack/constraints/polling architecture in every prompt or
  reply — they are established context, not per-task content.
- Loading external skills for problems this repo's skills already cover.

When the task is *editing the skill system itself*, apply
`skill-maintenance` (validation checklist, overlap rules) — this skill
covers efficient *use* of context, not maintenance of the skills.
