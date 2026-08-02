# REVIEW.md

> Reusable post-implementation review process. The reviewer compares the
> implementation against the original plan and checks it against the project's
> quality and security bars. Reviews live in `docs/ai/reviews/`.

---

## Who Reviews

- **Web AI** performs the primary review (architecture, plan compliance, security).
- **Desktop AI** performs read-only verification against the actual code when the
  change is HIGH/CRITICAL or when the Web AI's review needs source confirmation.

## Review Inputs

- The approved plan (`docs/ai/plans/PLAN-….md`)
- The implementation report (from OpenCode)
- The relevant code diff
- The analysis and verification docs
- The acceptance criteria from the plan

## Review Checklist

For each item, record a verdict: `PASS`, `FAIL`, or `NEEDS WORK` with a note.

### Requirements
- Does the implementation fulfill every acceptance criterion in the plan?
- Does it solve the problem from the analysis?

### Correctness
- Does the code do what the plan says?
- Are there logic errors, off-by-ones, wrong conditions?
- Do the tests actually exercise the new behavior?

### Architecture
- Does it respect the documented architecture (ARCHITECTURE.md)?
- Does it follow existing patterns (Actions/Services, Form Requests, Policies)?
- Any unnecessary redesign or scope creep?

### Security
- SSRF: any new external-URL handling? DNS/IP checks applied?
- XSS: any new rendering of user content?
- CSRF: are all mutations protected?
- Authorization: is `$this->authorize()` present on every protected mutation?
- Validation: does validation match the endpoint category (Form Request for
  structured input, inline `$request->validate()` for simple single-field
  action endpoints)?
- Rate limiting: are new public endpoints throttled?
- Information leakage: 404-not-403 behavior, no internals leaked?

### Authorization
- Ownership vs. member vs. guest boundaries respected?
- Room lock / membership checks intact?

### Data integrity
- Any DB changes safe? Transactions where multi-step writes happen?
- No destructive behavior without a documented rollback?

### Performance
- No N+1 queries (eager loading used)?
- No per-request work that should be cached?
- Polling behavior within the single-core budget?

### Error handling
- Loading / error / success / empty states present for async operations?
- User-facing error messages in Persian, no raw exceptions?

### Edge cases
- Empty states, unauthorized access, missing resources (404), race conditions?

### Regression risk
- What existing behavior could this break?
- Do the existing suites still pass?

### Tests
- New tests cover the change?
- Backend / frontend / E2E / a11y where applicable?
- Do the quality commands pass (lint, type-check, Pint, format)?

### Documentation
- docs/TASK.md updated?
- ISSUE_REGISTER.md updated (if an issue was addressed)?
- DECISION_LOG.md updated (if an architecture decision changed)?
- FRONTEND_CONTRACT.md updated (if a contract changed)?
- ARCHITECTURE.md / PROJECT_BASELINE.md updated if the architecture changed?

### Scope creep
- Was anything implemented beyond the plan? If yes, is it justified and
  documented?

## Review Report Format

```
# Review: <Plan / TAM-XXX>

- **Date:**
- **Reviewer:** <Web AI / Desktop AI / Human>
- **Plan reference:** <docs/ai/plans/PLAN-….md>
- **Risk level:** <LOW / MEDIUM / HIGH / CRITICAL>

## Verdict

<APPROVED / APPROVED WITH NOTES / CHANGES REQUESTED>

## Checklist Results

| Item | Verdict | Note |
|---|---|---|
| Requirements | | |
| Correctness | | |
| Architecture | | |
| Security | | |
| Authorization | | |
| Data integrity | | |
| Performance | | |
| Error handling | | |
| Edge cases | | |
| Regression risk | | |
| Tests | | |
| Documentation | | |
| Scope creep | | |

## Comparison to Plan

<Where the implementation matches the plan, and any deviations. Each deviation
must be explained and justified, or flagged as a failure to return to OpenCode.>

## Open Items / Follow-ups

- <list any remaining issues, with owner>
```

## Rules

1. Review against the plan, not against an ideal redesign.
2. `APPROVED WITH NOTES` is fine for minor, non-blocking items — record them.
3. Any FAIL on Security, Authorization, or Data integrity ⇒ `CHANGES REQUESTED`.
4. Desktop AI verification is required for HIGH/CRITICAL changes.
5. After approval, record the result and update the issue register and decision
   log as needed.
