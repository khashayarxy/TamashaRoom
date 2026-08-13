---
name: ai-efficiency
description: How to minimize AI context/token usage while working in TamashaRoom — progressive disclosure, never repeating established context, efficient task-prompt construction, what to read first, targeted exploration and test execution, and avoiding re-reading known files. Use when a task involves exploring the repo or reading docs, or when drafting a prompt for another agent.
---

# AI Efficiency (Token & Context Optimization)

The goal: spend tokens on *deciding and verifying*, not on *re-reading or
restating what is already known*.

## Progressive Disclosure — Read in This Order

1. `AGENTS.md` — always loaded; contains the stack, constraints, and the
   skill table. Read it once, trust it.
2. The **one skill** that matches the task (load it via the skill tool, not
   by opening the file manually).
3. Only the **specific chapter** of `docs/SYSTEM.md` the skill points to —
   never the whole 10,000+ line file. Use the chapter→line index at the top
   of `docs/SYSTEM.md` to open exactly that range.
4. `docs/MAP.md` to locate the subsystem's files, then the actual source
   files via targeted searches first.

**Never read whole files you only need a slice of.** Use grep/glob to locate
the exact function, then read only that window. `docs/SYSTEM.md` is the
biggest trap — it is the full spec and should almost never be read end to end.

## Do Not Repeat Established Context

Project context is established once, in `AGENTS.md` and the skills. Do not
re-produce it per task:

- Do not restate the stack, hosting constraints, polling architecture,
  deployment model, or previously verified decisions in every prompt or reply.
- Do not re-derive what a skill already says — reference "per the existing
  polling architecture" instead of re-explaining it.
- Do not ask the user to restate a task that the repository's docs
  (`docs/TASK.md`, docs, skills) already define. Search first; ask only when
  the repo genuinely does not answer.
- Do not rediscover facts verified earlier in the same task/session — once
  verified, they are established.
- Prefer short references over long explanations: "per the deployment
  checklist", "as documented in `docs/SYSTEM.md` 18.05", "the existing
  `usePlaybackSync` hook".
- If this session already read a file, don't re-read it unless it may have
  changed. After editing, re-read only the edited region.
- When `AGENTS.md`, a skill, and `docs/SYSTEM.md` disagree: code wins over
  docs, SYSTEM.md wins over skills, skills win over AGENTS.md summary.

**What you already know (do not re-derive):** the stack (Laravel 13 + PHP 8.4
+ Inertia 2 + React 19 + TS strict + Vite 5); the constraint (shared cPanel,
1 core, 2GB RAM, no Redis/WebSockets/persistent workers, polling architecture,
database-backed cache/session/queue); where things live (via `docs/MAP.md`);
test counts (canonical in `docs/TASK.md` — never hardcode or re-derive; an
actual test run that conflicts with the doc wins and the doc needs a
correction); and that `docs/TASK.md` is the done/pending record — check it
before assuming something is unimplemented.

## Efficient Task Prompts

When constructing a prompt (for yourself or another agent), include only:

1. **Objective** — the outcome, in one or two sentences.
2. **Constraints** — only those not already in AGENTS.md/skills (repo rules
   are inherited; do not restate them).
3. **Relevant files/areas** — exact paths or subsystems.
4. **Acceptance criteria** — how to know it's done.
5. **Verification command(s)** — the specific test/lint/type-check to run.
6. **Stop conditions** — what not to do (e.g. "no new dependency", "do not
   commit"), only when they aren't already project rules.

Do **not** pad prompts with generic instructions like "be careful", "don't
break anything", or "follow the architecture" — those rules already exist.
For prompts handed to another coding agent, prefer file/section references
("see `docs/SYSTEM.md` 18.05") over copying documentation blocks into the
prompt.

## Targeted Exploration

- **Find a symbol**: grep for the class/function name (include `app/`,
  `resources/js/`) — don't browse directories. For a subsystem's full file
  set, use `docs/MAP.md`.
- **Understand a flow**: read the route definition, then the controller,
  then only the service/action it calls. Follow the call chain, don't fan out.
- **Check if something exists**: `Test-Path` / glob — one command.
- **Check test counts**: read `docs/TASK.md` — do not run the full suite just
  to re-derive a canonical count.
- **Code reading order — function before file**: locate the symbol, read the
  surrounding function/class, then the caller, then the callee, then the
  relevant test — expanding only if ambiguity remains. For large files prefer
  symbol search and line-range reads; when you have the function, stop.
- **Task scoping — decide before reading**: resolve objective, subsystem
  (MAP.md), owning skill, likely files, SYSTEM.md chapter (via line index),
  smallest source window, and smallest test scope (`--filter=`/file) *before*
  opening anything. If the answer is still fuzzy after one targeted read,
  that is a signal to ask, not to read more.

## Stop-Reading / Stop-Searching

**STOP exploration when:** the affected code path, owning rules,
implementation location, expected behavior, and existing covering tests are
all known — i.e. no unresolved architecture question remains. Do not search
further "to gain confidence."

**STOP test exploration when:** existing tests establish current behavior,
the new behavior is clear, and the smallest test location is known.

**STOP reading a file** once you have the function/symbol you need.

## Targeted Test Execution

Run only the suites the change can affect. Start at `testing-strategy`,
"Verification Escalation" (Levels 1–4) — the canonical decision table and
command matrix. Recommend Level 1–2 by default; escalate to the full suite
only for the justifications listed there. Running everything for a doc edit
is wasted tokens.

## Reports & Outputs

- Report **conclusions and evidence locations** (`file:line`), not verbatim
  dumps of files the user can open.
- When asked for a count or status, give the number and the method used to
  obtain it.
- Do not copy-paste large doc sections into answers; point to them instead.

## Anti-Patterns Specific to AI Work

- Reading `docs/SYSTEM.md` in full "to be safe" — never; chapter-scoped only.
- Re-running the whole test suite to confirm one change — filtered runs.
- Copying an entire skill or doc into a reply — reference it.
- Re-verifying facts already verified this session without reason.
- Restating the stack/constraints/polling architecture in every prompt.
- Loading external skills for problems this repo's skills already cover.

When the task is *editing the skill system itself*, apply
`skill-maintenance` (validation checklist, overlap rules) — this skill
covers efficient *use* of context, not maintenance of the skills.
