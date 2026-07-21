---
name: react-rules
description: React 19 implementation rules for TamashaRoom — component purity, hooks, state, keys, and React Compiler-aware performance. Use when writing or editing any .tsx component or hook under resources/js.
---

# React Rules

Full detail: `docs/SYSTEM.md`, Chapter 17 (React Rules).

React is a library, not a framework. It provides primitives and trusts you to
use them well. These rules exist because that flexibility is also the danger.

## Component Rules

1. **Components are pure functions.** Same props + state → same JSX. No
   `console.log`, DOM manipulation, network requests, or random values during
   render. Side effects belong in `useEffect`, event handlers, or the server.
2. **Props are read-only.** Never mutate them — always create a new value
   when transforming props (`[...users].sort()`, not `users.sort()`).
3. **Lift state carefully.** State lives at the lowest common ancestor that
   needs it, no higher. State placed too high causes unnecessary re-renders
   in components that don't use it. Use Context if prop drilling exceeds 2 layers.
4. **Children over configuration props.** Use composition (`<Dialog><DialogTitle>...`)
   instead of config props (`<Dialog title="..." primaryAction="...">`) —
   it's more flexible and doesn't require predicting every use case.

## State Rules

1. **State is minimal and derived.** Don't store computed values in state —
   compute them at render time (`const filtered = items.filter(...)`, not a
   second `useState` + `useEffect` synced to it). Derived state can't go stale.
2. **Functional updates** when new state depends on old state:
   `setCount(c => c + 1)`, never `setCount(count + 1)` (stale-closure risk
   under batching).
3. **Normalized shape** for related entities — flat, keyed by ID, not deeply
   nested. Nested state requires deep cloning to update safely.

## Performance Rules (React Compiler is enabled)

The React Compiler is on for this project (wired through the Vite plugin,
`babel-plugin-react-compiler`). It already performs the memoization a
`useMemo`/`useCallback`/`React.memo` would, based on real data-flow analysis.

1. **Don't optimize prematurely.** Measure with React DevTools Profiler first.
   With the Compiler enabled, profiling usually finds nothing left to fix by hand.
2. **Component splitting beats memoization.** Before reaching for
   `React.memo`, ask: can this be split into two components instead? Splitting
   is free; memoization has comparison/dependency-tracking overhead.
3. **Manual `useMemo`/`useCallback`/`React.memo` only where the Compiler
   cannot reach**: plain utility modules outside component/hook files, or a
   stability contract an external non-React library's identity check depends
   on. Adding them out of habit inside a component the Compiler already
   covers is the **Redundant Memoization anti-pattern** — it's noise, not
   protection, and a wrong manual dependency array can reintroduce the exact
   bug memoization was meant to prevent.
4. **Keys are identity, not a perf knob.** Use stable, unique IDs (`project.id`),
   never array index or `Math.random()` — wrong keys cause lost component
   state and misidentified DOM updates.

## Checklist (from SYSTEM.md 17.06)

- Pure function, no side effects during render.
- Props treated as immutable.
- State at the lowest necessary level; composition over config props.
- Hooks called only at the top level; `useEffect` used only for external
  system synchronization (never data transformation or event handling — see
  the `anti-patterns` skill).
- `useMemo`/`useCallback` used only where the Compiler doesn't reach.
- State is minimal; computed values derived, not stored.
- Functional updater used when state depends on previous state.
- List items use stable, unique keys.
- Performance measured before optimized; splitting preferred over memoization.
