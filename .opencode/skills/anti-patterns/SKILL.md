---
name: anti-patterns
description: Common anti-patterns to avoid or catch in self-review for TamashaRoom — prop drilling, god components, useEffect abuse, premature abstraction, magic strings, loading spinner overuse, any types, and redundant memoization. Use before finishing any change, as a final self-review pass.
---

# Anti-Patterns

Full detail: `docs/SYSTEM.md`, Chapter 27 (Anti Patterns).

Anti-patterns are the "obvious" solutions that appear correct but produce
negative consequences. Check for these before considering any change done.

## Prop Drilling
**Symptom**: passing a prop through 3+ layers of components that don't use
it themselves. **Fix**: React Context (or Zustand for UI state) for deeply
shared data.

## God Component
**Symptom**: one component that fetches data, manages state, renders UI,
and handles events — all in one file, usually 200+ lines. **Fix**: split
into focused components and custom hooks.

## useEffect Abuse
**Symptom**: `useEffect` used for data transformation or event handling that
could be derived or handled directly.
```tsx
// ❌ Bad
const [filtered, setFiltered] = useState([]);
useEffect(() => { setFiltered(items.filter(i => i.active)); }, [items]);

// ✅ Good — derived during render
const filtered = items.filter(i => i.active);
```
`useEffect` is for synchronizing with an *external* system (subscriptions,
the polling hook, DOM APIs) — not for computing values from props/state.

## Premature Abstraction
**Symptom**: a generic hook/utility/component built before it's used more
than once. **Fix**: Rule of Three — write it specific the first two times,
abstract only on the third real use.

## Magic Strings
**Symptom**: string literals for statuses/types scattered through the
codebase (`status === 'active'`) where a typo isn't caught by TypeScript.
**Fix**: a union type (`type Status = 'active' | 'inactive' | 'pending'`).

## Loading Spinner Overuse
**Symptom**: a spinner for every async operation regardless of duration.
**Fix** — graduated response:
- **< 200ms**: no indicator (optimistic UI).
- **200ms - 1s**: skeleton placeholder.
- **> 1s**: skeleton + progress indicator.
- **Background operations**: subtle status indicator, not a blocking spinner.

## `any` Type
**Symptom**: `any` used to bypass type checking. It removes all type safety,
hides bugs until runtime, and propagates through everything it touches.
**Fix**: `unknown` + type guards, generics, or proper typing.

## Redundant Memoization
**Symptom**: `React.memo`/`useMemo`/`useCallback` added out of habit on a
codebase where the React Compiler is already enabled. It's redundant (the
Compiler already does this via data-flow analysis) and an incorrect manual
dependency array can silently reintroduce the exact bug memoization was
meant to prevent. See the `react-rules` skill for where manual memoization
is actually still appropriate.

## When and How to Refactor

Full detail: `docs/SYSTEM.md`, Chapter 26 (Refactoring). Refactoring improves
code without changing external behavior — it is not a rewrite and not a
place to sneak in new features.

**When to refactor** — any of these triggers:
- **Rule of Three**: the same code has been copy-pasted three times.
- **Name test**: a function can't be named in one clear phrase — it's doing too much.
- **Comment test**: a comment explains *what* the code does, not *why* — the code itself is unclear.
- **Change test**: one requirement change touches five places — too coupled.
- **Read test**: understanding a function requires scrolling — it's too long.

**Common patterns**: Extract Function (a function does more than one thing),
Extract Component (a component renders multiple distinct sections), Extract
Hook (a component mixes UI logic with business logic — see the `useEffect`
abuse pattern above), Replace Conditional with Polymorphism (an if/else or
switch grows past 3 branches — replace with a lookup config object).

**Refactoring safety net** (non-negotiable order):
1. Confirm tests exist and pass **before** touching the code — see the
   `testing-strategy` skill. If there are no tests, write them first.
2. Make one refactoring at a time; commit after each.
3. Confirm tests still pass **after**.
4. Have it reviewed — a refactor is still a change (see `code-review-rules`).

Never refactor as "I don't like this" — the motivation should be one of the
five triggers above, scoped narrowly (not "rewrite the whole feature"), with
enough time to actually finish it.

## Final Self-Review Checklist (from SYSTEM.md 27.10)

Before considering any change done, verify you have not introduced:
- Prop drilling through 3+ layers.
- A god component (>200 lines or doing >3 distinct things).
- `useEffect` for data transformation or event handling.
- Manual memoization where the React Compiler already covers it.
- A premature abstraction (used only once).
- Magic strings for types or statuses.
- Loading spinners for operations under 200ms.
- `any` types or `as` casts to silence TypeScript.
- Inline styles or CSS-in-JS.
- Client-side data fetching for data a controller could have passed as an
  Inertia prop.
