# ANALYZE.md

> Reusable template for turning an idea or bug report into a structured analysis.
> Use this before planning or implementing anything non-trivial. The analysis must
> never assume implementation details without verification.

---

## How to Use

Copy this template into a new analysis document (e.g.
`docs/ai/audits/ANALYSIS-<shortname>.md`), fill in every section, and keep it
updated as facts change. If a section genuinely does not apply, write "N/A" and
say why — do not delete it silently.

---

# Analysis: <Title>

- **Date:** <YYYY-MM-DD>
- **Raised by:** <Human / Web AI / Desktop AI / OpenCode>
- **Risk level (proposed):** <LOW / MEDIUM / HIGH / CRITICAL>
- **Related issue (if any):** <TAM-XXX or none>

## Objective

What are we trying to achieve? One or two sentences. This is the "why" — it is
not a list of implementation steps.

## Current Behavior

What does the system actually do today? Base this on the real source, not on what
someone wishes it did. Quote file:line references where possible.

## Expected Behavior

What should it do instead? Be specific enough that a reviewer could agree or
disagree with the statement.

## Relevant Architecture

Which parts of the architecture are involved? Reference `ARCHITECTURE.md`
sections and the actual files. Include the relevant constraints (shared-hosting
budget, polling-only sync, authorization boundaries, etc.).

## Affected Areas

- Backend: <files / controllers / models / routes>
- Frontend: <pages / components / hooks / stores>
- Database: <migrations / schema>
- Tests: <which suites must change or be added>
- Docs: <which docs must be updated>

## Known Constraints

- Shared-hosting budget (no Docker, Redis, WebSockets, persistent workers)
- Polling-only real-time delivery
- Strict TypeScript; no `any`
- Mutation validation by endpoint category: structured input → Form Request;
  simple single-field action endpoints → inline `$request->validate()`;
  Inertia forms → `useForm`
- RTL/Persian default, logical properties only
- <anything else relevant>

## Risks

What could go wrong? Security, data integrity, performance (single CPU core),
regression, and production impact. Rate each: HIGH / MEDIUM / LOW.

## Questions

Open questions that must be answered before planning. If a question affects the
approach, it must be answered first.

## Initial Hypotheses

Likely causes or approaches — clearly marked as **hypotheses**, not facts. Each
hypothesis should state what evidence would confirm or refute it.

## Required Codebase Investigation

The specific reads/searches the Desktop AI must perform to verify the hypotheses.
List concrete files, classes, and routes.

- [ ] Read <file> — verify <claim>
- [ ] Search for <pattern> — find all usages of <thing>
- [ ] Check <test> — does behavior exist as tested?

## Acceptance Criteria

Measurable, testable outcomes. When this analysis is complete, these statements
should be either true or explicitly decided against.

## Outcome / Status

Updated as the workflow progresses:

- [ ] Analysis written
- [ ] Codebase investigation complete
- [ ] Hypotheses confirmed / rejected (record which)
- [ ] Risk assessment finalized
- [ ] Handed off to planning
