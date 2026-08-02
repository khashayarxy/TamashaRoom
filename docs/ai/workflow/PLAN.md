# PLAN.md

> Reusable implementation-planning template. A plan must be concrete enough that
> OpenCode can execute it without redesigning anything. Copy this template into a
> new plan document (e.g. `docs/ai/plans/PLAN-<shortname>.md`).

---

# Implementation Plan: <Title>

- **Date:** <YYYY-MM-DD>
- **Author:** <Web AI>
- **Approved by (human):** <name / date> — **mandatory before implementation**
- **Change Request:** <CR-YYYY-NNN — for MEDIUM and above; see WORKFLOW.md>
- **Risk level:** <LOW / MEDIUM / HIGH / CRITICAL>
- **Related analysis:** <docs/ai/audits/ANALYSIS-….md>
- **Related issues:** <TAM-XXX, …>
- **Rollback plan (CRITICAL items only):** <how to undo this safely>

---

## Goal

What does "done" look like? Measurable, testable. This must match the acceptance
criteria from the analysis.

## Current State

What exists today, with file references. OpenCode must be able to find the exact
code this plan modifies.

## Problem

The concrete problem being solved. Reference confirmed findings only — do not
build a plan on unverified claims.

## Root Cause

The verified root cause (from the analysis + verification steps). If the root
cause is not confirmed, planning stops until it is.

## Proposed Solution

The chosen approach and why. Keep it minimal — no unrelated architectural
redesign. If the analysis considered alternatives, note briefly why this one wins.

## Architecture Impact

- Does this change any documented architecture (ARCHITECTURE.md)?
- Does it touch the shared-hosting constraints?
- Does it touch the polling/broadcast pattern?
- Does it add or change a contract (FRONTEND_CONTRACT.md)?

## Files To Change

List every existing file that will be modified, with the specific change per file.

## Files To Create

List every new file, with its purpose.

## Database Changes

- Migrations: <names, what they do, why>
- Indexes, constraints, data backfills: <details>
- Destructive operations: <explicitly flag + rollback>

## API Changes

- New/changed endpoints: <method, path, request shape, response shape>
- Rate limits affected: <which named limiter>
- Contract updates needed in FRONTEND_CONTRACT.md: <yes/no, which sections>

## Frontend Changes

- Pages/components/hooks/stores touched
- New Zod schema / TS type additions
- RTL / accessibility implications

## Backend Changes

- Controllers, Form Requests, Policies, Models, Actions/Services touched
- Validation rules and authorization changes

## Security Considerations

- SSRF, XSS, CSRF, authorization, rate limiting implications
- Any new external-URL handling or upload path
- Confirm `$this->authorize()` is used for every protected mutation
- Confirm validation by endpoint category: structured input → Form Request;
  simple single-field action endpoints → inline `$request->validate()`

## Edge Cases

List the edge cases the implementation must handle (empty states, race
conditions, unauthorized access, invalid input, missing resources → 404, etc.).

## Backward Compatibility

- Will existing data or behavior break?
- Is this safe to deploy alongside the current version?
- Does any client (frontend, external API) depend on the old shape?

## Testing Strategy

- Backend tests: <which suite(s), what new cases>
- Frontend tests: <which component/unit tests, what new cases>
- E2E / a11y: <which specs, any new>
- Manual verification steps: <what to click/check locally>

## Rollback Considerations

- Revert path for code and for any DB changes
- How to detect a problem after deploy

## Acceptance Criteria

Checklist. OpenCode reports against this list when done; the reviewer checks
against it.

- [ ] <criterion 1>
- [ ] <criterion 2>
- [ ] All existing tests still pass
- [ ] No new lint / type-check / Pint / format violations

## Implementation Order

Numbered, concrete steps for OpenCode, in dependency order. Each step should be
independently verifiable.

1. <step>
2. <step>
3. <step>

---

## Plan Approval

- **Human approval:** <date + signature>
- **Changes after approval:** <record any approved deviations here with date>
