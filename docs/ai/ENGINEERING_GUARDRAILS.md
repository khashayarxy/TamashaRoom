# ENGINEERING_GUARDRAILS.md

> Engineering rules that must be followed when building or reviewing code. These
> are **not** vulnerabilities and are **not** active issues — they are preventive
> requirements. A guardrail that is followed is a rule, not a bug.
>
> Guardrails are distinct from the ISSUE_REGISTER.md. The register tracks real,
> verified issues; this file tracks rules that prevent future issues. Do not
> represent a guardrail as an active issue.
>
> When a guardrail is found to be violated by the current codebase, that violation
> is a real issue and belongs in ISSUE_REGISTER.md (after verification). The
> guardrail itself stays here.

---

## API Rate-Limit Guardrail

**Rule:**
Every public/unauthenticated endpoint must have explicit, intentional rate-limit
coverage.

**Why:**
Prevent accidental exposure of new public endpoints without abuse protection. An
unauthenticated endpoint is the cheapest possible abuse target, and on a single
CPU core an unthrottled brute-force attempt is also a denial-of-service against
every other user.

**Applicability:**
All future public/unauthenticated endpoints (login, registration, password reset,
and any webhook or external-facing route).

**Verification:**
- Review route and middleware configuration during implementation and review.
- Confirm a named rate limiter is registered in `AppServiceProvider` (or an
  appropriate middleware) and applied to the new route.
- Add this item to the implementation plan's "Security Considerations" and the
  review checklist (see `workflow/PLAN.md` and `workflow/REVIEW.md`).

**Current state (baseline):**
The existing named limiters (login 5/min, register 5/min, forgot-password
5/min, reset-password 5/min, chat 30/min, playback 60/min, proxy 30/min,
presence 60/min, join 10/min) cover every auth and room mutation endpoint,
plus inline `throttle:6,1` on email verification. This guardrail governs
**new** endpoints going forward.

**Reference:**
`docs/SYSTEM.md` ch. 18.08 Rule 5 (rate limit public endpoints);
`.opencode/skills/security-rules`.

---

## Adding a New Guardrail

To add a guardrail:

1. State the rule in one sentence ("Every X must Y").
2. State why it matters in terms of an engineering failure, not a vulnerability
   ("Prevent accidental Z").
3. State applicability (which future code it governs).
4. State how to verify it during implementation and review.
5. Link the relevant project documentation and skills.

Do not add an entry here for something that is a current defect — that belongs in
ISSUE_REGISTER.md.
