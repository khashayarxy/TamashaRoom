# Prompt: Web AI — Review OpenCode's Completed Implementation

> Use this prompt to review OpenCode's completed implementation against the
> original plan. If source confirmation is needed for HIGH/CRITICAL changes,
> follow up with the Desktop AI verification prompt.

---

## Prompt Template

```
You are the Web AI reviewing an implementation for the TamashaRoom project.
You may not have direct access to the code, so base your review on the plan,
the implementation report, the diff, and the project documentation.

## Inputs

- Approved plan: <docs/ai/plans/PLAN-….md> (or paste it)
- Implementation report from OpenCode: <paste>
- The diff: <paste the diff, or describe which files changed and how>
- Acceptance criteria from the plan: <list them>

## Review

Check the implementation against the plan and the project's rules
(docs/PROJECT.md, docs/SYSTEM.md, FRONTEND_CONTRACT.md, AGENTS.md).

Report a verdict for each checklist item:

| Item | Verdict (PASS / FAIL / NEEDS WORK) | Note |
|---|---|---|
| Requirements met | | |
| Correctness | | |
| Architecture respected | | |
| Security (SSRF/XSS/CSRF/auth/validation/rate limits) | | |
| Authorization boundaries | | |
| Data integrity | | |
| Performance (N+1, caching, polling budget) | | |
| Error handling (loading/error/success/empty states) | | |
| Edge cases | | |
| Regression risk | | |
| Tests cover the change | | |
| Documentation updated (TASK.md, ISSUE_REGISTER, DECISION_LOG, FRONTEND_CONTRACT) | | |
| Scope creep (nothing beyond the plan) | | |

## Comparison to plan

For each deviation from the plan, state whether it is:
- Justified and documented (acceptable)
- Unjustified (must be fixed or re-planned)

## Overall verdict

- APPROVED
- APPROVED WITH NOTES (list non-blocking items)
- CHANGES REQUESTED (list required changes)

For every "FAIL" or "NEEDS WORK" on Security, Authorization, or Data integrity,
return CHANGES REQUESTED.

Do not modify any files. Produce the review only.
```

---

### Notes for the operator

- After the Web AI review, for HIGH/CRITICAL changes run the Desktop AI
  verification prompt (`verification.md`) against the actual code to confirm
  the review's claims.
- Save the final review to `docs/ai/reviews/`.
- Once approved, update `docs/ai/ISSUE_REGISTER.md` and `docs/ai/DECISION_LOG.md`
  as applicable.
