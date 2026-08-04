---
name: performance-rules
description: Performance rules for TamashaRoom — bundle size, images, fonts, rendering, list virtualization, controller query performance, caching, and the single-CPU-core concurrency budget. Use when a change could affect load time, query count, or how many requests a feature generates (especially anything involving polling).
---

# Performance Rules

Full detail: `docs/SYSTEM.md`, Chapter 21 (Performance).

## The Single-Core Concurrency Budget (read this first)

There is **one CPU core**, shared by Apache, PHP-FPM, and MySQL. No
auto-scaling, no second instance, no edge network. Every request that blocks
that core longer than necessary directly slows down every other concurrent
visitor. This is the most important constraint in the whole project.

- **Never do expensive synchronous work inside a request that doesn't need
  the result immediately** — image resizing beyond one upload-time pass,
  sending email, generating reports. Queue it instead (see
  `laravel-backend-rules`).
- Treat a slow query as a shared-resource problem: one unindexed query
  holding a MySQL connection blocks every other request waiting on that table.
- **Room-based polling is a direct multiplier on this budget.** A watch-party
  room polling on the tiered cadence (3s active while playing, 10s idle while
  paused — see `use-playback-sync.ts`) is N rooms × M members requests every
  interval, sustained for as long as the room is open — not a brief spike.
  Keep the polling interval conservative and cap members per room. Migrating
  to Reverb is the real fix once usage numbers justify it — not a premature one.

## Frontend

- Bundle size audited with `npx vite-bundle-visualizer`; heavy page-specific
  dependencies (chart libraries, rich text editors) load lazily with
  `lazy()` + `<Suspense>`, not from a shared layout every page loads.
- Images pre-optimized at build time (static assets) or upload time (user
  content), always with explicit `width`/`height` to prevent layout shift.
- Fonts are self-hosted WOFF2 with `font-display: swap`.
- The React Compiler is enabled; manual memoization only where it doesn't
  reach (see `react-rules`). Component splitting is preferred over memoization.
- Lists that can grow unbounded are virtualized; current bounded lists (chat
  capped at 50 messages, member lists capped by `max_members`) render in full
  without a virtualization library.
- Measure with **INP** (Interaction to Next Paint), not the deprecated FID.
  Target Lighthouse score > 90 on all metrics.

## Backend

- Controllers eager-load relationships and `select()` only the columns a
  page actually renders — narrower queries matter more here than on a
  multi-core server with connection pooling.
- Expensive, slow-changing reads are cached with the database cache driver
  (`Cache::remember()`) and invalidated on the write that changes them.
- Slow, non-critical data is deferred with `Inertia::defer()` rather than
  blocking the whole page's first paint.
- PHP has no async/await concurrency — the performance lever is doing
  **less work per request** (fewer queries, narrower columns), not
  parallelizing independent reads.

## Checklist (from SYSTEM.md 21.11)

- Performance budget defined and measured with INP.
- Bundle size audited; heavy components lazy-loaded.
- Images pre-optimized with explicit dimensions; fonts self-hosted WOFF2.
- React Compiler enabled; manual memoization only where it doesn't reach.
- Long lists virtualized only when they can grow unbounded (current lists are bounded).
- Controllers eager-load and select only needed columns.
- Expensive reads cached and invalidated on write.
- No request does expensive synchronous work that could be queued.
- Lighthouse score > 90 for all metrics.
