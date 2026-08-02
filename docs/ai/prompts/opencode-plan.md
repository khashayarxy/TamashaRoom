# Prompt: OpenCode — Precise Implementation Request from an Approved Plan

> Use this prompt to generate an exact implementation request for OpenCode from
> an approved plan. OpenCode is the implementation agent; the request must be
> concrete enough that it does not need to redesign anything.

---

## Prompt Template

```
You are OpenCode, the implementation agent for TamashaRoom.

## Task

Implement the approved plan in `docs/ai/plans/<PLAN FILE>` for the goal
"<SHORT GOAL>". The plan has been reviewed and approved by a human.

## Context you must respect

- The project's canonical docs: docs/SYSTEM.md, docs/PROJECT.md, docs/TASK.md,
  FRONTEND_CONTRACT.md, and the .opencode/skills/ rules.
- The project's hard constraints: shared cPanel hosting — no Docker, no Redis,
  no WebSockets, no persistent background workers, no horizontal scaling.
  Persian/RTL default; logical properties only. Strict TypeScript, no `any`.
  Structured input → Form Request; simple single-field action endpoints → inline
  `$request->validate()`; Inertia forms → `useForm`; authorization via Policies
  with `$this->authorize()`; business logic in Actions/Services.
- Do NOT redesign the architecture. Follow the plan.

## What to do

1. Read the plan and the relevant existing code before writing anything.
2. Implement exactly what the plan specifies. Do not expand scope.
3. If the plan is ambiguous or conflicts with a project rule or documented
   architecture decision, STOP and report the conflict instead of guessing.
4. Preserve existing behavior unless the plan explicitly changes it.
5. Run the relevant validation:
   - `php artisan test`
   - `npm run test`
   - `npm run test:e2e` and `npm run test:a11y` if the change touches those paths
   - `npm run lint`, `npm run type-check`, `npm run format`, `./vendor/bin/pint`
6. Fix any failures your change introduces.

## Report back

- Exactly what changed (file:line references, new files)
- Tests performed and their results (command → pass/fail + counts)
- Any failures, with reason and whether pre-existing
- Any deviations from the plan, with justification
- Remaining risks and open questions
- Confirmation that nothing outside the plan was changed

Do not mark the work complete until the relevant tests and quality commands pass.
```

---

### Notes for the operator

- This prompt is intentionally the same shape as `workflow/IMPLEMENT.md`; the
  workflow file defines the process, this prompt turns it into an invocation.
- Paste the approved plan content or reference the file path. In an OpenCode
  session, reference the file path so it can read it directly.
- For CRITICAL plans, append: "Report the rollback plan and any destructive
  operations before executing them."
