---
name: react-rules
description: React 19 implementation rules and component architecture for TamashaRoom — component purity, hooks, state placement, the five component categories, when to extract a component, cn() variants, and React Compiler-aware performance. Use when writing or editing any .tsx component or hook under resources/js, or when deciding where a component/hook/state belongs.
---

# React Rules & Component Architecture

Full detail: `docs/SYSTEM.md`, Chapters 14 (Component Philosophy), 15
(Component System), 16 (Frontend Architecture), 17 (React Rules).

This skill covers both *where a component goes and whether it should exist*
(architecture) and *how to implement it correctly* (React rules). For what
not to do, see `code-review-rules` (anti-patterns).

## Component Rules

1. **Components are pure functions.** Same props + state → same JSX. No
   `console.log`, DOM manipulation, network requests, or random values during
   render. Side effects belong in `useEffect`, event handlers, or the server.
2. **Props are read-only.** Never mutate them — always create a new value
   when transforming props (`[...users].sort()`, not `users.sort()`).
3. **Lift state carefully.** State lives at the lowest common ancestor that
   needs it, no higher. State placed too high causes unnecessary re-renders.
   Use Context if prop drilling exceeds 2 layers.
4. **Children over configuration props.** Use composition
   (`<Dialog><DialogTitle>...`) instead of config props
   (`<Dialog title="..." primaryAction="...">`).

## State Rules

1. **State is minimal and derived.** Don't store computed values in state —
   compute them at render time (`const filtered = items.filter(...)`, not a
   second `useState` + `useEffect` synced to it). Derived state can't go stale.
2. **Functional updates** when new state depends on old state:
   `setCount(c => c + 1)`, never `setCount(count + 1)` (stale-closure risk).
3. **Normalized shape** for related entities — flat, keyed by ID, not deeply
   nested. Nested state requires deep cloning to update safely.

## Where Should This State Live?

| Situation | Use |
|---|---|
| Used in one component only | `useState` |
| Shared between parent and one child | Lift to the common parent |
| Shared across a subtree, changes infrequently | React Context |
| Global, changes frequently, many consumers | Zustand (with selectors) |

State is co-located with the feature that uses it — feature-local Zustand
stores live in that feature's folder, not a single global store. Never lift
state higher than the lowest common ancestor that needs it.

## Should This Be Its Own Component?

Create a new component when **all** of these are true:
1. Used in **two or more places** (Rule of Three — copy-paste twice,
   abstract on the third use).
2. Represents a **distinct concept**, not just a styled `<div>`.
3. Has **enough complexity** to justify it (logic, state, multiple elements).
4. Needs **isolated testing**.

Do **not** extract when:
- Used in only one place with no complexity.
- It's a styled wrapper with no behavior — inline the Tailwind classes.
- It would have only one prop — use the value directly.
- It's a one-off layout adjustment.

## The Five Component Categories

Every component belongs to exactly one. This determines its directory.

| Category | Examples | Business logic? | Domain-specific? | Directory |
|---|---|---|---|---|
| **Primitive** | `Stack`, `Flex`, `Box` | No | No | `Components/ui/` |
| **UI** | `Button`, `Input`, `Dialog` | No | No | `Components/ui/` |
| **Composite** | `RoomCard`, `MemberList`, `RoomChat` | Maybe (local state ok) | Yes | `Components/composite/` |
| **Layout** | `AppLayout`, `AuthenticatedLayout`, `GuestLayout` | No | No | `Layouts/` |
| **Page** | `Rooms/Show.tsx`, `Dashboard.tsx` | No (delegates to hooks) | Yes | `Pages/` |

Rules per category:
- **Primitives**: style-only, never import UI components or composites.
- **UI components**: built on primitives or Headless UI, accessible by default,
  no business logic, themed through design tokens.
- **Composites**: compose UI components rather than recreating them, may hold
  local state, co-located with the feature they serve.
- **Layout**: no business logic, accept `children`, define spatial relationships
  not visual style.
- **Pages**: one per route, compose layout/composite/UI components, no reusable
  logic (extract to hooks), no direct styling.

## The Component Contract

Every component is a contract: given these props, it renders this UI and
behaves this way. A prop interface should be minimal (3-5 props typical) and
fully typed.

**`className`/`style` are escape hatches — forbidden for styling overrides or
behavioral changes.** Acceptable only for layout positioning on wrapper
components, one-off third-party integration, or an emergency patch with a
ticket to fix it properly. If a component needs a visual variant, add a
variant to its cn() config — don't let a consumer override it from outside.

## Variants with `cn()`

Use the `cn()` utility (clsx + tailwind-merge) for conditional classes —
it's at `@/lib/utils`. Variant names are semantic (`variant: 'error'`),
never visual (`variant: 'red'`).

```ts
import { cn } from '@/lib/utils';

const inputClasses = cn(
  'flex w-full rounded-md border bg-transparent px-3 py-2 text-sm',
  variant === 'error' && 'border-error',
  size === 'sm' && 'h-8',
  size === 'md' && 'h-10',
  size === 'lg' && 'h-12',
);
```

Never manual string concatenation with a `className` prop — that doesn't
resolve conflicting Tailwind classes (see `typescript-tailwind-rules`).

## Performance Rules (React Compiler is enabled)

The React Compiler is on (wired through the Vite plugin,
`babel-plugin-react-compiler`). It already performs the memoization a
`useMemo`/`useCallback`/`React.memo` would, based on real data-flow analysis.

1. **Don't optimize prematurely.** Measure with React DevTools Profiler first.
2. **Component splitting beats memoization.** Before `React.memo`, ask: can
   this be split into two components instead? Splitting is free; memoization
   has comparison/dependency-tracking overhead.
3. **Manual `useMemo`/`useCallback`/`React.memo` only where the Compiler
   cannot reach**: plain utility modules outside component/hook files, or a
   stability contract an external non-React library's identity check depends
   on. Adding them out of habit inside a component the Compiler already covers
   is **redundant memoization** — noise, not protection, and a wrong manual
   dependency array can reintroduce the exact bug memoization was meant to
   prevent.
4. **Keys are identity, not a perf knob.** Use stable, unique IDs, never
   array index or `Math.random()`.

## Common Mistakes

- Extracting every `<div>` into a component ("component explosion").
- Never extracting, leading to god components (see `code-review-rules`).
- A composite component that's actually generic (should be a UI component).
- A UI component with domain-specific logic baked in (should be a composite).
- Putting layout logic directly in a page component instead of a Layout.
- Accepting `className` as an escape hatch instead of adding a proper variant.

## Checklist

- Pure function, no side effects during render; props treated as immutable.
- State at the lowest necessary level; composition over config props.
- Hooks called only at the top level; `useEffect` used only for external
  system synchronization (never data transformation — see `code-review-rules`).
- `useMemo`/`useCallback` used only where the Compiler doesn't reach.
- State is minimal; computed values derived, not stored.
- Functional updater used when state depends on previous state.
- List items use stable, unique keys.
- Component categorized correctly; `cn()` variants, not `className` overrides.
