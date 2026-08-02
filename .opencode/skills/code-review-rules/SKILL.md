---
name: code-review-rules
description: Self-review and code review standards for TamashaRoom — the review checklist across correctness, architecture, components, TypeScript, styling, accessibility, performance, testing, and documentation; the anti-patterns to catch; refactoring triggers and safety net; and the Definition of Done. Use when reviewing a diff, self-reviewing before finishing any change, or considering a refactor.
---

# Code Review & Anti-Patterns

Full detail: `docs/SYSTEM.md`, Chapter 25 (Review Engine), Chapter 26
(Refactoring), Chapter 27 (Anti Patterns), Chapter 29 (Definition of Done).

A reviewer (including a self-review pass) has three responsibilities:
**correctness** (does this do what it claims?), **quality** (does it meet the
project's standards?), and **maintainability** (will the next person
understand it without asking the author?). Not a style checker (linters do
that), not a rubber stamp.

## The Review Checklist

**Correctness**: solves the stated problem; edge cases handled (empty arrays,
null values, network failures); error paths tested, not just happy paths; no
obvious bugs; TypeScript compiles clean in strict mode.

**Architecture**: business logic separated from UI; state in the right place
(not over-lifted, not buried); no prop drilling past 2 layers; API calls in
hooks, not components; no new dependency without justification (see
`mvp-scope-decisions`).

**Components**: name describes what it is; props minimal and typed; no
`className` prop used for style overrides; composition over configuration;
not a god component (>200 lines is a smell — see anti-patterns below).

**TypeScript**: no undocumented `any`; props explicitly typed; explicit
return types on exported functions; discriminated unions for state machines;
no `as` casts.

**Styling**: Tailwind utilities, not inline styles; no unjustified arbitrary
values; `cn()` for conditional classes; mobile-first; dark mode colors defined.

**Accessibility**: semantic HTML; keyboard accessible; focus managed for
modals; WCAG 2.2 AA contrast; 24×24px minimum target size; screen reader
tested or automated (see `accessibility-rules`).

**Performance**: no unnecessary re-renders (memoization only where the
Compiler doesn't reach); images pre-optimized; no large dependency added
without bundle analysis; controllers own data-fetching (see
`performance-rules`).

**Testing**: unit tests for business logic; integration tests for user flows;
error paths tested; tests deterministic (see `testing-strategy`).

**Documentation**: complex logic has a "why" comment; public APIs have JSDoc;
PR description explains the change and reasoning.

## Anti-Patterns to Catch

The "obvious" solutions that appear correct but produce negative consequences:

- **Prop drilling** — prop passed through 3+ layers that don't use it. Fix:
  Context or Zustand for UI state.
- **God component** — one component fetches data, manages state, renders UI,
  and handles events (usually 200+ lines). Fix: split into focused components
  and custom hooks.
- **useEffect abuse** — `useEffect` for data transformation that could be
  derived at render time. `useEffect` is for synchronizing with an *external*
  system (subscriptions, polling hooks, DOM APIs), not computing values from
  props/state.
- **Premature abstraction** — a generic hook/utility built before it's used
  more than once. Rule of Three: write it specific the first two times,
  abstract only on the third real use.
- **Magic strings** — string literals for statuses/types scattered through
  the codebase. Fix: union types (`type Status = 'active' | 'inactive'`).
- **Loading spinner overuse** — a spinner for every async operation. Fix —
  graduated response: **<200ms** no indicator (optimistic UI); **200ms-1s**
  skeleton; **>1s** skeleton + progress; background ops get a subtle status
  indicator, not a blocking spinner.
- **`any` type** — bypasses type checking, hides bugs until runtime. Fix:
  `unknown` + type guards, generics, or proper typing.
- **Redundant memoization** — `React.memo`/`useMemo`/`useCallback` out of
  habit where the React Compiler already handles it (see `react-rules`).
- **Client-side fetching of initial page data** — the exception is the
  approved live-room polling endpoints (playback state, presence, chat) via
  dedicated hooks (see `laravel-backend-rules`).

## When and How to Refactor

Refactoring improves code without changing external behavior — it is not a
rewrite and not a place to sneak in new features.

**When to refactor** — any of these triggers:
- **Rule of Three**: the same code has been copy-pasted three times.
- **Name test**: a function can't be named in one clear phrase.
- **Comment test**: a comment explains *what*, not *why*.
- **Change test**: one requirement change touches five places.
- **Read test**: understanding a function requires scrolling.

**Common patterns**: Extract Function, Extract Component, Extract Hook,
Replace Conditional with Polymorphism (an if/else or switch grows past 3
branches — replace with a lookup config object).

**Refactoring safety net** (non-negotiable order):
1. Confirm tests exist and pass **before** touching the code — write them
   first if missing (see `testing-strategy`).
2. Make one refactoring at a time; commit after each.
3. Confirm tests still pass **after**.
4. Have it reviewed — a refactor is still a change.

Never refactor as "I don't like this" — the motivation should be one of the
five triggers, scoped narrowly, with enough time to actually finish it.

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
5. **Documented** — JSDoc, PR description, and `docs/TASK.md` updated (see `AGENTS.md`).
6. **Reviewed** — at least one pass through this checklist, self or otherwise.
7. **Merged** — CI passes, no conflicts.
8. **Deployed** — staging first, then production, per `docs/PROJECT.md`'s deploy steps.
9. **Monitored** — errors and performance observable after shipping.

## Self-Review Before Considering Work Done

- Read the diff yourself, line by line.
- Remove all debug code (`console.log`, `debugger`) and commented-out code.
- Run the linter, type checker, and tests — fix everything before moving on.
- Test the feature manually: happy path and error paths.
- Check accessibility (keyboard nav, contrast) and responsive behavior.
- Cross-check the anti-patterns list above.
- Update `docs/TASK.md` if this change isn't tracked there yet.
