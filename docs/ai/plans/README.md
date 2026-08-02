# plans/

**Implementation plans.**

Place approved, concrete implementation plans here. A plan must be executable by
OpenCode without redesign (see `workflow/PLAN.md` for the template). A plan that
has not been approved by a human must say so in the file and must NOT be given to
OpenCode for execution.

## Naming

- `PLAN-<shortname>.md`

## Lifecycle

1. Drafted by the Web AI from the analysis.
2. Reviewed against the analysis and the project rules.
3. Approved by a human (recorded in the file).
4. Executed by OpenCode (`workflow/IMPLEMENT.md`, `prompts/opencode-plan.md`).
5. Result reviewed (`workflow/REVIEW.md`).

## Conventions

- Every plan links to its analysis and any related issue IDs (TAM-XXX).
- Every plan has acceptance criteria and an implementation order.
- CRITICAL plans include a rollback plan.
