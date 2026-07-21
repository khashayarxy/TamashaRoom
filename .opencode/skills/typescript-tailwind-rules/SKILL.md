---
name: typescript-tailwind-rules
description: TypeScript strict-mode and Tailwind CSS 4 rules for TamashaRoom — shared types across the PHP/TS boundary, Zod validation, the cn() utility, arbitrary values, and dark mode. Use when writing types, Zod schemas, or Tailwind class names.
---

# TypeScript & Tailwind Rules

Full detail: `docs/SYSTEM.md`, Chapters 19 (TypeScript Rules) and 20 (Tailwind Rules).

## TypeScript

- **Strict mode always.** No `any` without a documented justification comment.
  Use `unknown` for truly unknown values, paired with a type guard.
- **Every value crossing a boundary is validated**: Zod on the TypeScript
  side, a Laravel Form Request on the PHP side. Never trust an Inertia prop,
  API response, or third-party payload without validating its shape at the edge.
- **Types are kept in sync across the language boundary deliberately** —
  nothing enforces this automatically between a Laravel API Resource and its
  TypeScript type. When you change one, change the other in the same PR.
- Infer types when obvious; write explicit types when complex or exported.
- Use discriminated unions for state machines, branded types to distinguish
  semantically different strings/numbers (e.g. `RoomId` vs `UserId`, both
  strings), and utility types (`Pick`, `Omit`, `Partial`) to derive types
  instead of duplicating them.
- No `as` casts to silence the compiler. No `@ts-ignore` without a ticket.

## Tailwind CSS 4

- Utilities for ~95% of styling (layout, spacing, typography, color, effects).
  Custom CSS only for complex keyframes, pseudo-elements, or third-party overrides.
- **Always use `cn()`** (clsx + tailwind-merge) to combine classes — never
  manual string concatenation with a `className` prop, since that doesn't
  resolve conflicting Tailwind classes.
  ```ts
  import { clsx, type ClassValue } from 'clsx';
  import { twMerge } from 'tailwind-merge';
  export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
  }
  ```
- **Avoid arbitrary values** (`w-[123px]`, `text-[#1a1a1a]`) — use the design
  system's scale. Acceptable exceptions: one-off layout calculations
  (`w-[calc(100%-2rem)]`), dynamic values from props, third-party constraints.
- **Mobile-first, min-width only**: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`,
  never `max-md:` desktop-first patterns.
- **Dark mode via the `dark:` prefix**, colors defined as semantic tokens
  (`bg-background dark:bg-background` via CSS variables), never arbitrary
  hex values duplicated per mode.
- Tailwind 4 uses **CSS-first configuration** — theme tokens live in
  `@theme` inside `resources/css/app.css`, not a `tailwind.config.ts`. Do not
  reintroduce a JS config file; it forks the source of truth.
  ```css
  @import "tailwindcss";
  @custom-variant dark (&:where(.dark, .dark *));
  @theme {
    --color-background: hsl(var(--background));
  }
  ```

## Checklist (from SYSTEM.md 19.11 / 20.08)

- Strict mode enabled; no `any` without justification; `unknown` for unknown values.
- Every cross-boundary value validated (Zod + Form Request).
- Types imported from one source, kept in sync with the PHP side deliberately.
- No `as` casts, no unticketed `@ts-ignore`.
- `cn()` used for all conditional classes.
- No arbitrary values without justification.
- Responsive classes are mobile-first (`min-width` only).
- Dark mode colors defined via `@theme`, not ad hoc hex values.
