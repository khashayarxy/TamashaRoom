---
name: code-review-rules
description: Self-review and code review standards for TamashaRoom — the review checklist across correctness, architecture, components, TypeScript, styling, accessibility, performance, testing, and documentation. Use when reviewing a diff or self-reviewing work before it's considered finished.
---

# Code Review Rules

Full detail: `docs/SYSTEM.md`, Chapter 25 (Review Engine).

A reviewer (including a self-review pass) has three responsibilities:
**correctness** (does this do what it claims?), **quality** (does it meet the
project's standards?), and **maintainability** (will the next person
understand it without asking the author?). Not a style checker (linters do
that), not a rubber stamp.

## The Review Checklist

**Correctness**: solves the stated problem; edge cases handled (empty
arrays, null values, network failures); error paths tested, not just happy
paths; no obvious bugs; TypeScript compiles clean in strict mode.

**Architecture**: business logic separated from UI; state in the right
place (not over-lifted, not buried); no prop drilling past 2 layers; API
calls in hooks, not components; no new dependency without justification.

**Components**: name describes what it is; props minimal and typed; no
`className` prop used for style overrides; composition over configuration;
not a god component (>200 lines is a smell — see `anti-patterns`).

**TypeScript**: no undocumented `any`; props explicitly typed; explicit
return types on exported functions; discriminated unions for state
machines; no `as` casts.

**Styling**: Tailwind utilities, not inline styles; no unjustified arbitrary
values; `cn()` for conditional classes; mobile-first; dark mode colors defined.

**Accessibility**: semantic HTML; keyboard accessible; focus managed for
modals; WCAG 2.2 AA contrast; 24×24px minimum target size; screen reader
tested or automated (see `accessibility-rules`).

**Performance**: no unnecessary re-renders (memoization only where the
Compiler doesn't reach, profiled not guessed); images pre-optimized; no
large dependency added without bundle analysis; controllers own
data-fetching; every fetch's cache behavior explicit (see `performance-rules`).

**Testing**: unit tests for business logic; integration tests for user
flows; error paths tested; tests deterministic (no randomness, no
time-based assertions); tests verify behavior, not implementation details.

**Documentation**: complex logic has a "why" comment; public APIs have
JSDoc; PR description explains the change and reasoning.

## Review Communication

Good comments are observation → concern → suggestion, with code where
possible:
> "This `useEffect` fetches data on mount. It bypasses caching and causes an
> extra re-render. Use the `useRoomMembers` hook instead."

Bad comments: "This is wrong" (not actionable), "I'd do it differently" (not
specific), "LGTM" without reading, "Fix this" (not constructive).

## The Definition of Done (SYSTEM.md Chapter 29)

A feature is not done when the code is written. It's done when it is:

1. **Correct** — all happy paths and error paths work.
2. **Accessible** — keyboard, screen reader, contrast (see `accessibility-rules`).
3. **Performant** — meets the performance budget (see `performance-rules`).
4. **Tested** — unit, integration, and manual (see `testing-strategy`).
5. **Documented** — JSDoc, PR description, and `docs/TASK.md` updated to
   reflect the new state (see `AGENTS.md`).
6. **Reviewed** — at least one pass through this checklist, self or otherwise.
7. **Merged** — CI passes, no conflicts.
8. **Deployed** — staging first, then production, per `docs/PROJECT.md`'s deploy steps.
9. **Monitored** — errors and performance are observable after shipping, not
   just assumed to be fine.

## Self-Review Before Considering Work Done

- Read the diff yourself, line by line.
- Remove all debug code (`console.log`, `debugger`) and commented-out code.
- Run the linter, type checker, and tests — fix everything before moving on.
- Test the feature manually: happy path and error paths.
- Check accessibility (keyboard nav, contrast) and responsive behavior.
- Cross-check against the `anti-patterns` skill.
