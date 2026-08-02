# WORKFLOW.md

> The complete AI-assisted development process for TamashaRoom. This defines who
> does what, in what order, and how the level of scrutiny scales with risk.

---

## Source-of-Truth Hierarchy

When sources conflict, the higher level always wins. A source beats a report; a
report never overrides source:

| Level | Source | Authority |
|---|---|---|
| 1 | Actual source code | **The ground truth.** Defines reality. |
| 2 | Executable tests / observable behavior | Verifies what the code actually does. |
| 3 | Canonical project docs (`docs/SYSTEM.md`, `docs/PROJECT.md`, `docs/TASK.md`) | Spec of record. |
| 4 | AI-maintained docs (`docs/ai/`) | Best-effort description; must not contradict higher levels. |
| 5 | AI reports / hypotheses (audits, reviews, conversations) | Evidence to be weighed, never authority. |

- If docs conflict with code, the code wins and the docs need a correction ticket.
- If a report contradicts verified source evidence, the report is wrong.
- Verification is how a level-5 claim becomes a level-1/2 fact.

## Roles (who does what)

| Stage | Who | Output | Writes files? |
|---|---|---|---|
| Analysis | Web AI | structured analysis (workflow/ANALYZE.md) | No — returns analysis |
| Codebase analysis | Desktop AI (read-only) | audit findings, evidence, file inventory | No — report only; operator saves to `audits/` |
| Independent review | Web AI (different model where possible) | confirmed/likely/unverified/false-positive classification | No — returns review |
| Verification | Desktop AI (read-only) | verdicts against the actual code | No — report only; operator/Web AI mirrors into `ISSUE_REGISTER.md` |
| Planning | Web AI | concrete plan (workflow/PLAN.md) | No — returns plan; operator saves to `plans/` |
| Approval | Human | go / no-go | — |
| Implementation | OpenCode | code changes + test results | Yes — source code |
| Review | Web AI (+ Desktop AI for verification) | review → `reviews/` | No — operator saves |

**Key rule:** Desktop AI is strictly read-only. It inspects the actual local
codebase and returns reports. It never edits code and never updates documentation
— including `docs/ai/` and `ISSUE_REGISTER.md`. All documentation updates are made
by Web AI / the human after reviewing a report.

## The Standard Workflow

```
 1. IDEA                          — a problem, feature request, or bug report
 2. WEB ANALYSIS                  — Web AI: understand problem, analyze architecture
 3. DESKTOP CODEBASE ANALYSIS     — Desktop AI: read-only inspection of actual code
 4. INDEPENDENT REVIEW            — Web AI or Claude: challenge assumptions
 5. DESKTOP VERIFICATION          — Desktop AI: verify/reject claims against the code
 6. FINAL PLAN                    — Web AI: concrete implementation plan
 7. HUMAN APPROVAL                — human decides; AI does not override
 8. OPENCODE IMPLEMENTATION       — OpenCode executes the approved plan
 9. WEB REVIEW                    — Web AI: review against the plan + architecture
10. DESKTOP POST-IMPLEMENTATION   — Desktop AI: read-only verification of the change
11. FIXES IF REQUIRED             — iterate 8→11 until clean
12. FINAL VERIFICATION            — tests, lint, type-check, build
13. UPDATE DOCUMENTATION          — docs/TASK.md, docs/ai/ registers, decision log
```

Not every change needs every stage. The **risk level** decides which stages are
**mandatory** and which are **optional**. See the risk table below.

## Risk-Scaled Workflows

### LOW

Simple, isolated, no security/sync/data implications.

**Examples:**
- UI copy or styling change
- Extracting a stateless presentational component
- Adding a non-sensitive test

**Workflow (short):**

| Stage | Mandatory? |
|---|---|
| Idea | ✔ |
| Plan (brief) | ✔ |
| Human approval | ✔ |
| OpenCode implementation | ✔ |
| Final verification | ✔ |
| Update documentation | ✔ |
| Web analysis | optional |
| Desktop analysis / review / verification | optional |

```
IDEA → PLAN (brief) → HUMAN APPROVAL → OPENCODE IMPLEMENTATION
→ FINAL VERIFICATION → UPDATE DOCUMENTATION
```

### MEDIUM

A normal feature or an isolated backend change with no auth/data-integrity risk.

**Examples:**
- A new non-sensitive field with its own Form Request
- A new page rendering existing data
- Frontend component with explicit loading/error/empty states

**Workflow:**

| Stage | Mandatory? |
|---|---|
| Idea | ✔ |
| Web analysis | ✔ |
| Desktop codebase analysis | ✔ |
| Final plan | ✔ |
| Human approval | ✔ |
| OpenCode implementation | ✔ |
| Review | ✔ |
| Final verification | ✔ |
| Update documentation | ✔ |
| Independent review | optional |
| Desktop post-implementation verification | optional |

```
IDEA → WEB ANALYSIS → DESKTOP CODEBASE ANALYSIS → FINAL PLAN
→ HUMAN APPROVAL → OPENCODE IMPLEMENTATION → REVIEW → FINAL VERIFICATION
→ UPDATE DOCUMENTATION
```

### HIGH

Cross-cutting, security-adjacent, or anything that changes shared behavior.

**Examples:**
- Authentication or authorization changes
- Database schema/migration changes
- Playback synchronization behavior
- Video proxy
- Security hardening
- Polling/broadcast patterns

**Workflow (full):**

| Stage | Mandatory? |
|---|---|
| Idea | ✔ |
| Web analysis | ✔ |
| Desktop codebase analysis | ✔ |
| Independent review | ✔ |
| Desktop verification | ✔ |
| Final plan | ✔ |
| Human approval | ✔ |
| OpenCode implementation | ✔ |
| Web review | ✔ |
| Desktop post-implementation verification | ✔ |
| Fixes if required | ✔ |
| Final verification | ✔ |
| Update documentation | ✔ |

```
IDEA → WEB ANALYSIS → DESKTOP CODEBASE ANALYSIS → INDEPENDENT REVIEW
→ DESKTOP VERIFICATION → FINAL PLAN → HUMAN APPROVAL → OPENCODE IMPLEMENTATION
→ WEB REVIEW → DESKTOP POST-IMPLEMENTATION VERIFICATION → FIXES IF REQUIRED
→ FINAL VERIFICATION → UPDATE DOCUMENTATION
```

### CRITICAL

Can cause data loss, security boundary breach, or production outage.

**Examples:**
- SSRF / external-URL handling
- Anything that can delete data (destructive migrations, cleanup actions)
- Payment/security boundary (n/a today, but applies if added)
- Production infrastructure changes
- Destructive database behavior

**Workflow (full + extra):**
Same as HIGH, all stages mandatory, plus:
- Mandatory independent review by a second model/pass
- Mandatory post-implementation verification by the Desktop AI
- A documented rollback plan in the plan file
- An explicit security review stage
- Strong, testable acceptance criteria in the plan

```
IDEA → WEB ANALYSIS → DESKTOP CODEBASE ANALYSIS → INDEPENDENT REVIEW
→ DESKTOP VERIFICATION → FINAL PLAN (+ rollback + acceptance criteria)
→ HUMAN APPROVAL → OPENCODE IMPLEMENTATION → WEB REVIEW → SECURITY REVIEW
→ DESKTOP POST-IMPLEMENTATION VERIFICATION → FIXES IF REQUIRED
→ FINAL VERIFICATION → UPDATE DOCUMENTATION
```

**Decision rule:** the full loop is never required for trivial changes, and
auth/sync/proxy/DB/security work is never run at LOW even for small diffs.

## Change Requests (CR)

A Change Request gives a medium/high/critical change a stable identifier so plans,
reviews, and the issue register can refer to it.

- **Format:** `CR-YYYY-NNN` (e.g. `CR-2026-001`).
- **Fields:** Title, Reason, Expected result, Risk (LOW/MEDIUM/HIGH/CRITICAL),
  Related issues (TAM-XXX).
- **Where it lives:** conceptual only — in the plan file and in the review/audit
  that references the change. No separate database, file, or numbering registry.
- **When it is used:** not for trivial changes. Only for changes that need a plan
  (MEDIUM and above).
- Do not fabricate a CR for already-completed work; if an existing change needs a
  CR for traceability, register it with a note that it is retrospective.

## AI Workflow Principles

These principles govern every interaction in this workflow:

1. **Source code is the source of truth** (hierarchy level 1). Documentation and
   reports describe the code; the code defines reality.
2. **AI reports are evidence, not authority.** A report is material for a human
   (and other AIs) to weigh, never an instruction that overrides the source.
3. **Independent review is valuable for high-risk changes.** A second model or a
   second pass catches assumptions the first author could not see.
4. **Never turn an unverified finding into a confirmed bug.** `UNVERIFIED` stays
   `UNVERIFIED` until the code confirms it.
5. **Planning should precede complex implementation.** Analysis and planning are
   cheap; a wrong implementation is expensive.
6. **OpenCode implements; it should not arbitrarily redesign.** Redesign requires
   a plan, review, and human approval.
7. **Desktop AI verifies against the actual codebase and is strictly read-only.**
   Claims are confirmed only where the real source supports them; the Desktop AI
   never edits code or documentation.
8. **Web AI performs architecture, planning, and review.** It reasons about design;
   it does not edit the local project.
9. **Human remains the final decision maker.** No AI step overrides a human call.
10. **Security-sensitive changes require stronger verification.** Auth, sync,
    proxy, DB, and SSRF boundaries get the full loop even for small diffs.
11. **Avoid unnecessary refactoring during bug fixes.** Fix the bug; keep the
    diff focused and reviewable.
12. **Keep documentation synchronized with important architectural decisions.**
    A decision that is not reflected in the docs is a decision that will be lost.
13. **Preserve a history of important audits, plans, and reviews.** `audits/`,
    `plans/`, and `reviews/` exist so past reasoning is never repeated from scratch.
14. **Prefer small, reversible implementation steps.** Small changes are easier to
    review, roll back, and bisect.
15. **Every significant change should have clear acceptance criteria.** "Done" is
    a measurable checklist item, not a feeling.

## Rules

1. **Humans decide.** Every plan needs human approval before OpenCode touches code.
2. **Desktop AI is read-only**, always. It verifies; it never edits — code or docs.
   If uncertain whether a command writes anything: DO NOT RUN IT. Prefer inspection
   over execution.
3. **OpenCode implements approved plans.** It does not silently redesign.
4. **Evidence over claims.** A finding that cannot be verified is `UNVERIFIED`,
   not a bug.
5. **Never turn an unverified finding into a confirmed bug.**
6. **Security-sensitive changes require stronger verification**, regardless of
   how small the diff looks.
7. **Small steps.** Prefer small, reversible implementations.
8. **Acceptance criteria exist before implementation starts.**
9. **Documentation stays in sync** — update docs/TASK.md, ISSUE_REGISTER.md, and
   DECISION_LOG.md as part of finishing the work.
10. **Use the source-of-truth hierarchy.** When sources conflict, the higher level
    wins; never let a report override verified source.

## Decision on Workflow Length

| Signal | Shorten to |
|---|---|
| Trivial copy/styling | LOW (analysis → implement → verify) |
| Same-request refactor, no behavior change | LOW/MEDIUM |
| Touches auth, sync, proxy, DB, or security | HIGH or CRITICAL, never less |
| Ambiguous requirement | Do not skip analysis; resolve before planning |
