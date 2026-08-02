# IMPLEMENT.md

> Instructions for how OpenCode should consume an approved implementation plan.
> OpenCode is the implementation agent: it executes the plan, validates the
> result, and reports. It does not silently redesign or expand scope.

---

## Before Writing Code

1. **Read the plan first.** The approved plan (`docs/ai/plans/PLAN-….md`) is the
   contract. If the plan is ambiguous, ask the human before guessing.
2. **Read the relevant existing code.** Understand the current implementation and
   its conventions before changing anything. Follow the codebase's established
   patterns (see `.opencode/skills/` for the project rules).
3. **Check the risk level.** HIGH/CRITICAL items demand extra care and a clear
   report of what was verified.

## During Implementation

- **Follow the approved plan.** Implement exactly what the plan specifies.
- **Avoid unrelated refactors.** Do not improve nearby code unless the plan says
  to. Preserve existing behavior unless the plan explicitly changes it.
- **Stay in scope.** Do not silently expand the scope. If you discover something
  the plan missed, stop and report it — do not fix it unilaterally.
- **Respect the architecture.** Do not redesign. If the plan would violate a
  documented architecture decision (ARCHITECTURE.md, DECISION_LOG.md) or a
  project rule (AGENTS.md), flag it instead of implementing it.
- **Respect the hosting budget.** Nothing that assumes Docker, Redis,
  WebSockets, persistent workers, or horizontal scaling.

## Validation

Before reporting completion:

1. **Run the relevant tests** for the changed area:
   - `php artisan test` — backend (PHPUnit)
   - `npm run test` — frontend (Vitest)
   - `npm run test:e2e` — E2E (Playwright, requires the dev server)
   - `npm run test:a11y` — accessibility
2. **Run the quality commands** if the project defines them:
   - `npm run lint`, `npm run type-check`, `npm run format`
   - `./vendor/bin/pint`
3. **Fix what your change broke.** If a pre-existing test fails unrelated to your
   change, note it in the report but do not hide it.

## Reporting

At the end, report exactly what changed and the results:

### Implementation Report: <Plan name / TAM-XXX>

**What was changed**
- <file:line references, one per change>
- New files created

**Tests performed**
- <command> → <result> (pass/fail + counts)

**Failures**
- <any failing tests, with the reason and whether pre-existing>

**Deviations from plan**
- <anything implemented differently, and why; or "none">

**Remaining risks**
- <anything not yet covered, open questions, follow-ups>

**Scope note**
- <confirm nothing outside the plan was changed, or list what was found>

## After the Report

- Do **not** update `docs/ai/` verdicts yourself; that is the reviewer's job.
  You may note documentation updates needed in your report.
- Wait for review feedback before considering the work finished.
