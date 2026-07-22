---
name: component-architecture
description: How to structure, categorize, name, and place components and state in TamashaRoom — component granularity, the five component categories, file structure, CVA variants, and state placement decisions. Use when deciding whether to extract a component/hook, where a new component belongs, or where a piece of state should live.
---

# Component Architecture

Full detail: `docs/SYSTEM.md`, Chapters 14 (Component Philosophy), 15
(Component System), 16 (Frontend Architecture). This is the "where does this
go, and should it even be its own thing" skill — `react-rules` covers *how*
to implement a component once you've decided to build it.

## Should This Be Its Own Component?

Create a new component when **all** of these are true:
1. Used in **two or more places** (or the Rule of Three — copy-paste twice,
   abstract on the third use).
2. Represents a **distinct concept**, not just a styled `<div>`.
3. Has **enough complexity** to justify it (logic, state, or multiple elements).
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
| **Layout** | `AppLayout`, `Sidebar`, `Header` | No | No | `Components/layout/` |
| **Page** | `Rooms/Show.tsx`, `Dashboard.tsx` | No (delegates to hooks) | Yes | `Pages/` |

Rules per category:
- **Primitives**: style-only, never import UI components or composites.
- **UI components**: built on primitives or Headless UI, accessible by default, no
  business logic, themed through design tokens.
- **Composites**: compose UI components rather than recreating them, may
  hold local state, co-located with the feature they serve.
- **Layout**: no business logic, accept `children`, define spatial
  relationships not visual style.
- **Pages**: one per route, compose layout/composite/UI components, no
  reusable logic (extract to hooks), no direct styling.

## The Component Contract

Every component is a contract: given these props, it renders this UI and
behaves this way. A prop interface should be minimal (3-5 props typical) and
fully typed.

**`className`/`style` are escape hatches — forbidden for styling overrides
or behavioral changes.** Acceptable only for layout positioning on wrapper
components, one-off third-party integration, or an emergency patch with a
ticket to fix it properly. If a component needs a visual variant, add a
variant to its CVA config (see below) — don't let a consumer override it
from outside.

## Variants with `cn()`

Use the `cn()` utility (wraps `clsx`) for conditional classes. Variant names
are semantic (`variant: 'error'`), never visual (`variant: 'red'`). The `cn()`
helper is already available at `@/lib/utils` (see its definition in `utils.ts`).

```ts
import { cn } from '@/lib/utils';

const inputClasses = cn(
  'flex w-full rounded-md border bg-transparent px-3 py-2 text-sm',
  variant === 'error' && 'border-error',
  size === 'sm' && 'h-8',
  size === 'md' && 'h-10',
  size === 'lg' && 'h-12',
);
  }
);
```

## Where Should This State Live?

| Situation | Use |
|---|---|
| Used in one component only | `useState` |
| Shared between parent and one child | Lift to the common parent |
| Shared across a subtree, changes infrequently | React Context |
| Global, changes frequently, many consumers | Zustand (with selectors) |

State is co-located with the feature that uses it — feature-local Zustand
stores live in that feature's folder, not a single global store. Never lift
state higher than the lowest common ancestor that needs it (see `react-rules`).

## Common Mistakes

- Extracting every `<div>` into a component ("component explosion").
- Never extracting, leading to god components (see `anti-patterns`).
- A composite component that's actually generic (should be a UI component).
- A UI component with domain-specific logic baked in (should be a composite).
- Putting layout logic directly in a page component instead of a Layout component.
- Accepting `className` as an escape hatch instead of adding a proper variant.
