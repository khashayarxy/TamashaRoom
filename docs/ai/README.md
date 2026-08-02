# docs/ai — AI-Assisted Engineering System

## What This Is

`docs/ai/` is the permanent record of how TamashaRoom uses multiple AI systems in a
controlled engineering loop. It captures the **workflow** (who does what), the
**prompts** used to invoke each AI, the **project baseline** and **architecture**
reference that any AI must read before acting, and the **historical evidence**
(audits, plans, reviews) that documents how decisions were made.

This directory exists because single-shot AI code generation does not scale to a
product with a strict hosting budget (shared cPanel: no Docker, no Redis, no
WebSockets, no background workers). TamashaRoom has instead standardized on a
multi-model loop where different AIs play different, non-overlapping roles and a
human makes the final call.

## Why It Exists

The project was audited through a multi-model workflow:

1. **ChatGPT Desktop** performed a read-only audit against the actual local source code.
2. **Claude** performed an independent review of that audit.
3. **ChatGPT Desktop** performed a second read-only verification pass against the actual source code.

That produced a large body of useful knowledge — and it would have been lost if it
had not been captured. This directory is the permanent home for that knowledge and
for the repeatable workflow that produced it.

## The AI Roles

| Role | Tool | Read-Only? | Responsibility |
|---|---|---|---|
| **Web AI** | ChatGPT Web or Claude Web | Yes — never touches the local project | Architecture, planning, independent review, high-level debugging, challenging assumptions |
| **Desktop AI** | ChatGPT Desktop or Claude Desktop | Yes — **strictly read-only** | Codebase analysis, verification of findings against the real source, identifying missed issues |
| **OpenCode** | OpenCode | No — the implementation agent | Executes approved plans, modifies code, creates/updates migrations when required, runs tests and validation |

### Rules of the Road

- **Desktop AI is always read-only.** It inspects and verifies; it never edits —
  not code, and not documentation (including `docs/ai/` and ISSUE_REGISTER.md).
  Its deliverable is a report; the Web AI / human updates the docs.
- **OpenCode is the implementation agent.** It implements approved plans; it does
  not independently redesign architecture when a reviewed plan already exists.
- **Humans make final decisions.** AI recommendations are evidence, not authority.

## The Development Loop

```
IDEA
  → WEB ANALYSIS
  → DESKTOP CODEBASE ANALYSIS
  → INDEPENDENT REVIEW
  → DESKTOP VERIFICATION
  → FINAL PLAN
  → HUMAN APPROVAL
  → OPENCODE IMPLEMENTATION
  → WEB REVIEW
  → DESKTOP POST-IMPLEMENTATION VERIFICATION
  → FIXES IF REQUIRED
  → FINAL VERIFICATION
  → UPDATE DOCUMENTATION
```

Not every change needs every stage. Risk decides the workflow length — see
`workflow/WORKFLOW.md` for the risk levels and which workflow each one needs.
Medium-and-above changes get a Change Request identifier (`CR-YYYY-NNN`) so plans,
reviews, and the issue register can reference them — see `workflow/WORKFLOW.md`.

## Analysis vs. Planning vs. Implementation vs. Review

| Phase | Question it answers | Who leads | Where it lives |
|---|---|---|---|
| **Analysis** | What is the problem, what is the current behavior, what are the hypotheses? | Web AI + Desktop AI | `workflow/ANALYZE.md`, outputs to `audits/` |
| **Planning** | What exactly will we change, in what order, with what acceptance criteria? | Web AI | `workflow/PLAN.md`, outputs to `plans/` |
| **Implementation** | Did OpenCode execute the plan correctly and nothing more? | OpenCode | `workflow/IMPLEMENT.md` |
| **Review** | Does the implementation meet the plan, the architecture, and the security bar? | Web AI + Desktop AI | `workflow/REVIEW.md`, outputs to `reviews/` |

## How the Files Are Organized

| File / Directory | Purpose |
|---|---|
| `README.md` | This file — overview of the whole system |
| `PROJECT_BASELINE.md` | Current, verified project baseline (stack, features, constraints) |
| `ARCHITECTURE.md` | Current architecture reference (structure, data flows, diagrams) |
| `ISSUE_REGISTER.md` | **Current known issue state** — what is confirmed, likely, unverified, resolved |
| `ENGINEERING_GUARDRAILS.md` | **Preventive engineering rules** — requirements for future code, not active issues |
| `DECISION_LOG.md` | Important architectural decisions and their rationale |
| `workflow/` | The reusable process templates (workflow, analyze, verify, plan, implement, review) |
| `prompts/` | Reusable prompts for each AI role (audit, independent review, verification, plan, review) |
| `audits/` | **Historical/raw analysis** — read-only audit reports and codebase investigations |
| `plans/` | **Implementation plans** — approved, concrete plans OpenCode executes |
| `reviews/` | **Post-implementation or independent reviews** — what was reviewed and found |

### The Three Archive Directories

- **AUDITS = historical/raw analysis.** Raw findings, file inventories, and evidence
  collected by the Desktop AI. These are inputs, not authority.
- **PLANS = implementation plans.** The concrete, executable plans that survive
  human approval and become OpenCode's instructions.
- **REVIEWS = post-implementation or independent reviews.** Verification that a
  change met its plan and did not regress anything.

## Source of Truth

The authoritative project documentation lives outside this directory:

- `docs/SYSTEM.md` — the full operating rules (29 chapters)
- `docs/PROJECT.md` — tech stack, directory layout, environment variables
- `docs/TASK.md` — what is done and what is pending
- `FRONTEND_CONTRACT.md` — every backend contract the frontend depends on
- `docs/deployment-checklist.md` — production deployment steps

`docs/ai/` summarizes and references those files; it does not replace them. Where
this directory and those files conflict, the source files win.

### Source-of-Truth Hierarchy

When sources conflict, the higher level wins:

| Level | Source | Authority |
|---|---|---|
| 1 | Actual source code | **The ground truth.** Defines reality. |
| 2 | Executable tests / observable behavior | Verifies what the code actually does. |
| 3 | Canonical project docs (`docs/SYSTEM.md`, `docs/PROJECT.md`, `docs/TASK.md`) | Spec of record. |
| 4 | AI-maintained docs (`docs/ai/`) | Best-effort description; must not contradict higher levels. |
| 5 | AI reports / hypotheses (audits, reviews, conversations) | Evidence to be weighed, never authority. |

Consequences:
- If docs conflict with code, the code wins and the docs need a correction ticket.
- If a report contradicts verified source evidence, the report is wrong.
- Verification is how a level-5 claim becomes a level-1/2 fact.
- `docs/ai/` (level 4) never contradicts `docs/` (level 3); if it does, the `docs/`
  file wins and `docs/ai/` is corrected.
